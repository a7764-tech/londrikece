import { getTransactionByTrackingCode } from "@/lib/db";

export async function GET(_request: Request, context: RouteContext<"/api/track/[code]">) {
  const { code } = await context.params;
  const transaction = await getTransactionByTrackingCode(code);
  if (!transaction) {
    return Response.json({ message: "Kode pelacakan tidak ditemukan." }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return Response.json({
    customerName: transaction.customerName,
    status: transaction.workStatus,
    serviceName: transaction.serviceName,
    createdAt: transaction.createdAt,
  }, { headers: { "Cache-Control": "no-store" } });
}
