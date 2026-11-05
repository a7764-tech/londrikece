import type { Metadata } from "next";
import TrackingStatus from "./tracking-status";

export const metadata: Metadata = {
  title: "Cek Status Cucian | Londri Kece",
  description: "Lihat status pengerjaan cucian Anda di Londri Kece.",
};

export const instant = false;

export default async function TrackingPage({ params }: PageProps<"/status/[code]">) {
  const { code } = await params;
  return <TrackingStatus code={code} />;
}
