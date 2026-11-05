import type { ServiceId, TariffConfig } from "./types";

export function calculatePrice(
  weight: number,
  serviceId: ServiceId,
  express: boolean,
  tariffs: TariffConfig,
) {
  const service = tariffs.services.find((item) => item.id === serviceId);
  if (!service) throw new Error("Jenis layanan tidak ditemukan.");
  return Math.round(weight * service.pricePerKg) + (express ? tariffs.expressFee : 0);
}

export function validateTransaction(input: unknown): {
  ok: true;
  value: { customerName: string; phone: string; notes: string; serviceId: ServiceId; weight: number; express: boolean };
} | { ok: false; message: string } {
  if (!input || typeof input !== "object") return { ok: false, message: "Data transaksi tidak valid." };
  const value = input as Record<string, unknown>;
  const customerName = typeof value.customerName === "string" ? value.customerName.trim() : "";
  if (!customerName) return { ok: false, message: "Nama pelanggan wajib diisi." };
  if (customerName.length > 80) return { ok: false, message: "Nama pelanggan maksimal 80 karakter." };
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const notes = typeof value.notes === "string" ? value.notes.trim() : "";
  if (phone.length > 20) return { ok: false, message: "Nomor WhatsApp maksimal 20 karakter." };
  if (notes.length > 250) return { ok: false, message: "Catatan maksimal 250 karakter." };
  if (typeof value.serviceId !== "string" || !["cuci-setrika", "cuci-kering", "setrika"].includes(value.serviceId)) {
    return { ok: false, message: "Pilih salah satu jenis layanan." };
  }
  const rawWeight = typeof value.weight === "number" ? String(value.weight) : String(value.weight ?? "");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(rawWeight)) {
    return { ok: false, message: "Berat harus berupa angka dengan maksimal dua angka di belakang koma." };
  }
  const weight = Number(rawWeight.replace(",", "."));
  if (!Number.isFinite(weight) || weight <= 0) {
    return { ok: false, message: "Berat harus lebih dari 0 kg." };
  }
  return { ok: true, value: { customerName, phone, notes, serviceId: value.serviceId as ServiceId, weight, express: value.express === true } };
}
