import { getTransactionById, saveTransaction } from "@/lib/db";
import type { PaymentStatus, WorkStatus } from "@/lib/types";
import { isCashierAuthenticated, unauthorizedCashierResponse } from "@/lib/auth";

export async function PATCH(request: Request, context: RouteContext<"/api/transactions/[id]">) {
  if (!isCashierAuthenticated(request)) return unauthorizedCashierResponse();
  const { id } = await context.params;
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ message: "Format data tidak valid." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ message: "Pembaruan tidak valid." }, { status: 400 });
  const { field, value, paymentMethod } = input as { field?: string; value?: string; paymentMethod?: string };
  const transaction = await getTransactionById(id);
  if (!transaction) return Response.json({ message: "Transaksi tidak ditemukan." }, { status: 404 });
  if (field === "workStatus" && value === "Selesai" && transaction.workStatus === "Diproses") transaction.workStatus = value as WorkStatus;
  else if (field === "paymentStatus" && value === "Lunas" && transaction.paymentStatus === "Belum Bayar" && ["Tunai", "QRIS", "Transfer"].includes(paymentMethod ?? "")) {
    transaction.paymentStatus = value as PaymentStatus;
    transaction.paymentMethod = paymentMethod;
  }
  else return Response.json({ message: "Perubahan status tidak diizinkan." }, { status: 400 });
  await saveTransaction(transaction);
  return Response.json({ transaction });
}
