export const SERVICE_IDS = ["cuci-setrika", "cuci-kering", "setrika"] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];
export type WorkStatus = "Diproses" | "Selesai";
export type PaymentStatus = "Belum Bayar" | "Lunas";

export type Tariff = { id: ServiceId; name: string; pricePerKg: number };
export type TariffConfig = { services: Tariff[]; expressFee: number };
export type Transaction = {
  id: string;
  trackingCode?: string;
  customerName: string;
  phone?: string;
  notes?: string;
  serviceId: ServiceId;
  serviceName: string;
  weight: number;
  express: boolean;
  unitRate?: number;
  expressFee?: number;
  total: number;
  workStatus: WorkStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  createdAt: string;
};
