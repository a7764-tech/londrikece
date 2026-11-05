import { getTariffs, saveTariffs } from "@/lib/db";
import { SERVICE_IDS, type TariffConfig } from "@/lib/types";
import { isCashierAuthenticated, unauthorizedCashierResponse } from "@/lib/auth";

export async function GET(request: Request) {
  if (!isCashierAuthenticated(request)) return unauthorizedCashierResponse();
  return Response.json({ tariffs: await getTariffs(), provisional: true });
}

export async function PUT(request: Request) {
  if (!isCashierAuthenticated(request)) return unauthorizedCashierResponse();
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ message: "Format data tidak valid." }, { status: 400 }); }
  if (!input || typeof input !== "object") return Response.json({ message: "Pengaturan tarif tidak valid." }, { status: 400 });
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.services) || value.services.length !== SERVICE_IDS.length) {
    return Response.json({ message: "Daftar tarif layanan tidak valid." }, { status: 400 });
  }
  const services = value.services as Array<Record<string, unknown>>;
  const validServices = SERVICE_IDS.every((id) => services.some((service) =>
    service.id === id && typeof service.name === "string" && Number.isInteger(service.pricePerKg) && Number(service.pricePerKg) >= 0
  ));
  if (!validServices || !Number.isInteger(value.expressFee) || Number(value.expressFee) < 0) {
    return Response.json({ message: "Tarif harus berupa rupiah bulat bernilai nol atau lebih." }, { status: 400 });
  }
  const tariffs: TariffConfig = {
    services: services.map((service) => ({
      id: service.id as TariffConfig["services"][number]["id"],
      name: service.name as string,
      pricePerKg: Number(service.pricePerKg),
    })),
    expressFee: Number(value.expressFee),
  };
  await saveTariffs(tariffs);
  return Response.json({ tariffs });
}
