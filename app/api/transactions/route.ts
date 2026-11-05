import { randomInt } from "node:crypto";
import { getTariffs, getTransactions, insertTransaction } from "@/lib/db";
import { calculatePrice, validateTransaction } from "@/lib/pricing";
import type { Transaction } from "@/lib/types";
import { isCashierAuthenticated, unauthorizedCashierResponse } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isCashierAuthenticated(request)) return unauthorizedCashierResponse();
  const transactions = await getTransactions();
  return Response.json(
    { transactions: transactions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isCashierAuthenticated(request)) return unauthorizedCashierResponse();
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ message: "Format data tidak valid." }, { status: 400 }); }
  const validation = validateTransaction(input);
  if (!validation.ok) return Response.json({ message: validation.message }, { status: 400 });
  const { customerName, phone, notes, serviceId, weight, express } = validation.value;
  const tariffs = await getTariffs();
  const service = tariffs.services.find((item) => item.id === serviceId);
  if (!service) return Response.json({ message: "Jenis layanan tidak ditemukan." }, { status: 400 });
  let transaction: Transaction | undefined;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate: Transaction = {
      id: `TRX-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
      trackingCode: String(randomInt(100_000, 1_000_000)),
      customerName, phone, notes, serviceId, serviceName: service.name, weight, express,
      unitRate: service.pricePerKg, expressFee: express ? tariffs.expressFee : 0,
      total: calculatePrice(weight, serviceId, express, tariffs),
      workStatus: "Diproses", paymentStatus: "Belum Bayar", createdAt: new Date().toISOString(),
    };
    if (await insertTransaction(candidate)) {
      transaction = candidate;
      break;
    }
  }
  if (!transaction) return Response.json({ message: "Kode pelacakan unik belum dapat dibuat. Silakan coba lagi." }, { status: 503 });
  return Response.json({ transaction }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
