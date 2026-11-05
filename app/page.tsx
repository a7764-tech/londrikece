"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import QRCode from "qrcode";
import type { ServiceId, TariffConfig, Transaction } from "@/lib/types";
import { calculatePrice } from "@/lib/pricing";

type PageId = "dashboard" | "kasir" | "queue" | "history" | "report" | "settings";
type Notice = { message: string; type: "success" | "error" };
type Draft = { customerName: string; phone: string; serviceId: ServiceId; weight: string; express: boolean; notes: string };
type TrackingReceipt = { transaction: Transaction; url: string; qrCode: string };
const navigation: { id: PageId; label: string; shortLabel: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: "⌂" },
  { id: "kasir", label: "Transaksi Baru", shortLabel: "Kasir", icon: "＋" },
  { id: "queue", label: "Antrean", shortLabel: "Antrean", icon: "◷" },
  { id: "history", label: "Riwayat", shortLabel: "Riwayat", icon: "▤" },
  { id: "report", label: "Rekap Laporan", shortLabel: "Rekap", icon: "▥" },
  { id: "settings", label: "Pengaturan Tarif", shortLabel: "Tarif", icon: "⚙" },
];
const paymentMethods = ["Tunai", "QRIS", "Transfer"];
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const serviceName = (item: Transaction, tariffs: TariffConfig | null) =>
  item.serviceName || tariffs?.services.find((service) => service.id === item.serviceId)?.name || "Layanan";
const dateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const todayString = () => dateKey(new Date());
const monthStart = () => `${todayString().slice(0, 7)}-01`;
const amountOf = (items: Transaction[]) => items.reduce((sum, item) => sum + Number(item.total || 0), 0);
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
const formatDate = (value: string) => new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

function StatusBadge({ value }: { value: string }) {
  const className = value === "Selesai" || value === "Lunas" ? "badge-green" : value === "Diproses" ? "badge-orange" : "badge-red";
  return <span className={`badge ${className}`}><span aria-hidden="true">{className === "badge-green" ? "✓" : value === "Belum Bayar" ? "!" : "◷"}</span>{value}</span>;
}

function EmptyState({ title, description = "Transaksi baru akan muncul di daftar ini." }: { title: string; description?: string }) {
  return <div className="empty"><div className="empty-icon" aria-hidden="true">🧺</div><strong>{title}</strong><span>{description}</span></div>;
}

function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-description">{description}</p></div>{children}</div>;
}

function TransactionTable({
  items, tariffs, onDetail, onComplete, onPay, compact = false,
}: {
  items: Transaction[]; tariffs: TariffConfig | null; onDetail: (item: Transaction) => void;
  onComplete: (item: Transaction) => void; onPay: (item: Transaction) => void; compact?: boolean;
}) {
  if (!items.length) return <EmptyState title={compact ? "Antrean masih kosong" : "Belum ada transaksi"} />;
  return <div className="table-wrap"><table><thead><tr>
    <th>No.</th><th>ID / Tanggal</th><th>Pelanggan / Layanan</th><th>Berat</th><th>Nilai</th><th>Pengerjaan</th><th>Pembayaran</th>{compact ? <th>Aksi</th> : <th>Aksi</th>}
  </tr></thead><tbody>{items.map((item, index) => <tr key={item.id}>
    <td>{index + 1}</td>
    <td><strong>{item.id}</strong><span className="subtext">{formatDate(item.createdAt)}</span></td>
    <td><span className="customer">{item.customerName}</span><span className="subtext">{serviceName(item, tariffs)}</span></td>
    <td>{Number(item.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</td>
    <td><strong>{money.format(item.total)}</strong>{item.express && <span className="subtext">Ekspres</span>}</td>
    <td><StatusBadge value={item.workStatus} /></td><td><StatusBadge value={item.paymentStatus} /></td>
    <td><div className="action-stack">
      {item.workStatus === "Diproses" && <button className="button button-small button-quiet" onClick={() => onComplete(item)}>Selesai</button>}
      {item.paymentStatus === "Belum Bayar" && <button className="button button-small button-primary" onClick={() => onPay(item)}>Lunas</button>}
      <button className="button button-small button-quiet" onClick={() => onDetail(item)}>Detail</button>
    </div></td>
  </tr>)}</tbody></table></div>;
}

export default function Home() {
  const router = useRouter();
  const [page, setPage] = useState<PageId>("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tariffs, setTariffs] = useState<TariffConfig | null>(null);
  const [draft, setDraft] = useState<Draft>({ customerName: "", phone: "", serviceId: "cuci-kering", weight: "", express: false, notes: "" });
  const [queueSearch, setQueueSearch] = useState("");
  const [queueWork, setQueueWork] = useState("");
  const [queuePayment, setQueuePayment] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyMethod, setHistoryMethod] = useState("");
  const [today, setToday] = useState("");
  const [historyStart, setHistoryStart] = useState("");
  const [historyEnd, setHistoryEnd] = useState("");
  const [appliedHistory, setAppliedHistory] = useState({ start: "", end: "" });
  const [historyPage, setHistoryPage] = useState(1);
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");
  const [appliedReport, setAppliedReport] = useState({ start: "", end: "" });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [payment, setPayment] = useState<Transaction | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Tunai");
  const [rateDraft, setRateDraft] = useState<TariffConfig | null>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const paymentDialog = useRef<HTMLDialogElement>(null);
  const trackingDialog = useRef<HTMLDialogElement>(null);
  const [trackingReceipt, setTrackingReceipt] = useState<TrackingReceipt | null>(null);

  const refresh = useCallback(async () => {
    const [txResponse, tariffResponse] = await Promise.all([fetch("/api/transactions"), fetch("/api/tariffs")]);
    if (!txResponse.ok || !tariffResponse.ok) throw new Error("Data laundry belum dapat dimuat.");
    const [txData, tariffData] = await Promise.all([txResponse.json(), tariffResponse.json()]);
    setTransactions(Array.isArray(txData.transactions) ? txData.transactions : []);
    setTariffs(tariffData.tariffs ?? null);
    setRateDraft(tariffData.tariffs ?? null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDay = todayString();
      const start = `${currentDay.slice(0, 7)}-01`;
      setToday(currentDay);
      setHistoryStart(start);
      setHistoryEnd(currentDay);
      setAppliedHistory({ start, end: currentDay });
      setReportStart(start);
      setReportEnd(currentDay);
      setAppliedReport({ start, end: currentDay });
      refresh().catch((error: unknown) => setNotice({ message: error instanceof Error ? error.message : "Data laundry belum dapat dimuat.", type: "error" }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (detail && detailDialog.current && !detailDialog.current.open) detailDialog.current.showModal();
  }, [detail]);
  useEffect(() => {
    if (payment && paymentDialog.current && !paymentDialog.current.open) paymentDialog.current.showModal();
  }, [payment]);
  useEffect(() => {
    if (trackingReceipt && trackingDialog.current && !trackingDialog.current.open) trackingDialog.current.showModal();
  }, [trackingReceipt]);

  const todayItems = useMemo(() => transactions.filter((item) => dateKey(item.createdAt) === today), [transactions, today]);
  const unpaid = useMemo(() => transactions.filter((item) => item.paymentStatus === "Belum Bayar"), [transactions]);
  const reportItems = useMemo(() => transactions.filter((item) => {
    const date = dateKey(item.createdAt);
    return date >= appliedReport.start && date <= appliedReport.end;
  }), [transactions, appliedReport]);
  const rangeHistory = useMemo(() => transactions.filter((item) => {
    const date = dateKey(item.createdAt);
    return date >= appliedHistory.start && date <= appliedHistory.end;
  }), [transactions, appliedHistory]);
  const filteredHistory = useMemo(() => rangeHistory.filter((item) =>
    (!historySearch || `${item.id} ${item.customerName}`.toLocaleLowerCase("id-ID").includes(historySearch.toLocaleLowerCase("id-ID")))
    && (!historyStatus || item.paymentStatus === historyStatus)
    && (!historyMethod || item.paymentMethod === historyMethod)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [rangeHistory, historySearch, historyStatus, historyMethod]);
  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / 5));
  const historyItems = filteredHistory.slice((historyPage - 1) * 5, historyPage * 5);
  const queueItems = useMemo(() => transactions.filter((item) =>
    (!queueSearch || `${item.id} ${item.customerName}`.toLocaleLowerCase("id-ID").includes(queueSearch.toLocaleLowerCase("id-ID")))
    && (!queueWork || item.workStatus === queueWork)
    && (!queuePayment || item.paymentStatus === queuePayment)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [transactions, queueSearch, queueWork, queuePayment]);

  function navigate(nextPage: PageId) {
    setPage(nextPage);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sesi belum dapat diakhiri.");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Sesi belum dapat diakhiri.", type: "error" });
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/transactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, weight: draft.weight }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Transaksi belum dapat disimpan.");
      const transaction = data.transaction as Transaction;
      if (!transaction.trackingCode) throw new Error("Transaksi tersimpan, tetapi kode pelacakan belum tersedia. Muat ulang antrean untuk memeriksa transaksi.");
      setDraft({ customerName: "", phone: "", serviceId: "cuci-kering", weight: "", express: false, notes: "" });
      setPage("queue");
      const url = new URL("/cek-status", window.location.origin).toString();
      let qrCode = "";
      try {
        qrCode = await QRCode.toDataURL(url, { width: 240, margin: 2, errorCorrectionLevel: "M" });
      } catch {
        setNotice({ message: "Transaksi tersimpan. QR tidak dapat dibuat; gunakan tautan atau kode pelacakan.", type: "error" });
      }
      setTrackingReceipt({ transaction, url, qrCode });
      void refresh().catch((error: unknown) => setNotice({ message: error instanceof Error ? error.message : "Antrean belum dapat diperbarui.", type: "error" }));
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Transaksi belum dapat disimpan.", type: "error" });
    } finally { setSaving(false); }
  }

  async function copyTrackingLink() {
    if (!trackingReceipt) return;
    try {
      await navigator.clipboard.writeText(trackingReceipt.url);
      setNotice({ message: "Tautan status berhasil disalin.", type: "success" });
    } catch {
      setNotice({ message: "Tautan tidak dapat disalin otomatis. Silakan salin alamat yang ditampilkan.", type: "error" });
    }
  }

  async function updateStatus(item: Transaction, field: "workStatus" | "paymentStatus", method?: string) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/transactions/${encodeURIComponent(item.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value: field === "workStatus" ? "Selesai" : "Lunas", ...(method ? { paymentMethod: method } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Status belum berhasil diperbarui.");
      setTransactions((items) => items.map((transaction) => transaction.id === item.id ? data.transaction : transaction));
      paymentDialog.current?.close();
      setPayment(null);
      setNotice({ message: `${item.id}: status berhasil diperbarui.`, type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Status belum berhasil diperbarui.", type: "error" });
    } finally { setBusyId(""); }
  }

  function exportCsv(source: "history" | "report" | "dashboard") {
    const items = source === "history" ? filteredHistory : reportItems;
    const columns = ["ID Transaksi", "Tanggal", "Nama Pelanggan", "WhatsApp", "Jenis Layanan", "Berat (kg)", "Ekspres", "Tarif/kg", "Biaya Ekspres", "Total", "Status Pengerjaan", "Status Pembayaran", "Metode Bayar", "Catatan"];
    const rows = items.map((item) => [item.id, item.createdAt, item.customerName, item.phone, serviceName(item, tariffs), item.weight, item.express ? "Ya" : "Tidak", item.unitRate ?? tariffs?.services.find((service) => service.id === item.serviceId)?.pricePerKg, item.expressFee ?? (item.express ? tariffs?.expressFee : 0), item.total, item.workStatus, item.paymentStatus, item.paymentMethod, item.notes]);
    const blob = new Blob(["\uFEFF", [columns, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `riwayat-laundry-${todayString()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice({ message: `${items.length} transaksi diekspor ke CSV.`, type: "success" });
  }

  function applyDateRange(start: string, end: string, kind: "history" | "report") {
    if (!start || !end || start > end) {
      setNotice({ message: "Pilih rentang tanggal yang valid.", type: "error" });
      return;
    }
    if (kind === "history") { setAppliedHistory({ start, end }); setHistoryPage(1); }
    else setAppliedReport({ start, end });
  }

  async function saveRates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rateDraft) return;
    setSaving(true);
    try {
      const response = await fetch("/api/tariffs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(rateDraft) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Pengaturan tarif belum berhasil disimpan.");
      setTariffs(data.tariffs);
      setRateDraft(data.tariffs);
      setNotice({ message: "Pengaturan tarif berhasil disimpan.", type: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Pengaturan tarif belum berhasil disimpan.", type: "error" });
    } finally { setSaving(false); }
  }

  const weightNumber = Number(draft.weight.replace(",", "."));
  const estimatedTotal = tariffs && Number.isFinite(weightNumber) && weightNumber > 0
    ? calculatePrice(weightNumber, draft.serviceId, draft.express, tariffs) : (draft.express ? tariffs?.expressFee ?? 0 : 0);
  const selectedRate = tariffs?.services.find((service) => service.id === draft.serviceId)?.pricePerKg ?? 0;
  const dateLabel = today ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${today}T12:00:00`)).toUpperCase() : "";
  const recent = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const todayQueue = [...todayItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);

  function makeChart(items: Transaction[]) {
    const days = 7;
    const buckets = Array.from({ length: days }, (_, index) => {
      if (!today) return { label: "", total: 0 };
      const date = new Date(`${today}T12:00:00`);
      date.setDate(date.getDate() - (days - 1 - index));
      const key = dateKey(date);
      return { label: new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(date), total: amountOf(items.filter((item) => dateKey(item.createdAt) === key)) };
    });
    const max = Math.max(1, ...buckets.map((bucket) => bucket.total));
    if (!today) return null;
    return <div className="bar-chart" role="img" aria-label={`Grafik nilai transaksi selama ${days} hari`}>
      {buckets.map((bucket, index) => <div className="bar-item" key={`${bucket.label}-${index}`}><span className="bar-value">{bucket.total ? money.format(bucket.total) : "—"}</span><div className="bar" style={{ height: `${Math.max(3, bucket.total / max * 95)}%` }} /><span>{bucket.label}</span></div>)}
    </div>;
  }

  const serviceSummary = (items: Transaction[]) => tariffs?.services.map((service) => {
    const matches = items.filter((item) => item.serviceId === service.id);
    return { ...service, count: matches.length, total: amountOf(matches) };
  }) ?? [];
  const dashboardServices = serviceSummary(reportItems);
  const serviceTotal = reportItems.length;
  const firstShare = serviceTotal ? Math.round((dashboardServices[0]?.count ?? 0) / serviceTotal * 100) : 0;
  const secondShare = firstShare + (serviceTotal ? Math.round((dashboardServices[1]?.count ?? 0) / serviceTotal * 100) : 0);

  function makeDashboardChart() {
    if (!appliedReport.start || !appliedReport.end) return null;
    const [startYear, startMonth, startDay] = appliedReport.start.split("-").map(Number);
    const [endYear, endMonth, endDay] = appliedReport.end.split("-").map(Number);
    const rangeStart = Date.UTC(startYear, startMonth - 1, startDay);
    const rangeEnd = Date.UTC(endYear, endMonth - 1, endDay);
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart > rangeEnd) return null;

    const calendarKey = (date: Date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    const firstWeek = new Date(rangeStart);
    firstWeek.setUTCDate(firstWeek.getUTCDate() - (firstWeek.getUTCDay() + 6) % 7);
    const buckets: { start: string; end: string; label: string; total: number }[] = [];
    for (const weekStart = firstWeek; weekStart.getTime() <= rangeEnd; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const startLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(weekStart);
      const endLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(weekEnd);
      buckets.push({
        start: calendarKey(weekStart),
        end: calendarKey(weekEnd),
        label: `${startLabel}–${endLabel}`,
        total: 0,
      });
    }

    for (const item of reportItems) {
      const created = dateKey(item.createdAt);
      const bucket = buckets.find((candidate) => created >= candidate.start && created <= candidate.end);
      if (bucket) bucket.total += Number(item.total || 0);
    }

    const max = Math.max(1, ...buckets.map((bucket) => bucket.total));
    const chartWidth = Math.max(520, 100 + buckets.length * 112);
    const plotStart = 50;
    const plotEnd = chartWidth - 50;
    const points = buckets.map((bucket, index) => ({
      ...bucket,
      x: buckets.length === 1 ? chartWidth / 2 : plotStart + index * (plotEnd - plotStart) / (buckets.length - 1),
      y: 112 - bucket.total / max * 78,
    }));
    const line = points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
    const area = `${line} L ${points[points.length - 1].x} 125 L ${points[0].x} 125 Z`;
    return <div className="dashboard-chart"><svg width={chartWidth} style={{ width: buckets.length > 4 ? `${chartWidth}px` : "100%", maxWidth: "none" }} viewBox={`0 0 ${chartWidth} 165`} role="img" aria-label={`Grafik nilai transaksi per minggu kalender, Senin sampai Minggu, dari ${appliedReport.start} sampai ${appliedReport.end}`}>
      <defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ffdc39" stopOpacity=".28" /><stop offset="100%" stopColor="#ffdc39" stopOpacity=".015" /></linearGradient></defs>
      {[36, 65, 94, 123].map((y) => <line key={y} className="chart-grid-line" x1="30" y1={y} x2={chartWidth - 30} y2={y} />)}
      <path className="chart-area" d={area} /><path className="chart-line" d={line} />
      {points.map((point) => <g key={point.start}><title>{`Minggu ${point.label}: ${money.format(point.total)} dalam rentang laporan`}</title><circle className="chart-point" cx={point.x} cy={point.y} r="4" /><text className="chart-label" x={point.x} y="148" textAnchor="middle">{point.label}</text><text className="chart-value" x={point.x} y={Math.max(20, point.y - 10)} textAnchor="middle">{point.total ? money.format(point.total) : "—"}</text></g>)}
    </svg></div>;
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><Image className="brand-mark" src="/laundry-logo.png" alt="Logo Londri Kece" width={60} height={60} priority /><div><div className="brand-name">Londri Kece</div><div className="brand-tagline">Bersih, Wangi, Harga Terjangkau</div></div></div><div className="profile"><span className="profile-avatar"><Image src="/laundry-logo.png" alt="" width={32} height={32} /></span><span>Kasir</span><button className="logout-button" type="button" onClick={() => void logout()}>Keluar</button></div></header>
    <div className="layout">
      <aside className="sidebar"><div className="nav-label">Menu utama</div><nav className="nav-list" aria-label="Navigasi utama">
        {navigation.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? "active" : ""}`} onClick={() => navigate(item.id)} aria-current={page === item.id ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{item.id === "queue" && <span className="nav-count">{transactions.filter((transaction) => transaction.workStatus === "Diproses").length}</span>}</button>)}
      </nav><div className="side-note"><strong>👋 Selamat bekerja!</strong>Kelola transaksi dengan mudah dan pastikan setiap cucian tercatat.</div></aside>
      <main id="main-content" tabIndex={-1}>
        {notice && <div className={`notice ${notice.type === "error" ? "error" : ""}`} role={notice.type === "error" ? "alert" : "status"}>{notice.message}</div>}

        {page === "dashboard" && <div className="dashboard-page">
          <section className="dashboard-welcome"><div className="dashboard-welcome-copy"><span className="dashboard-welcome-mark" aria-hidden="true">🧺</span><div><h1>Selamat Datang, Kasir!</h1><p>Kelola transaksi dan pantau aktivitas laundry.</p></div></div><span className="welcome-spark" aria-hidden="true">✦</span><div className="welcome-art" aria-hidden="true"><span className="welcome-bubble one" /><span className="welcome-bubble two" /><span className="welcome-bubble three" /><span className="welcome-shirt">👕</span></div></section>
          <section className="dashboard-stats"><article className="dashboard-stat"><span className="dashboard-stat-icon">◉</span><div><div className="dashboard-stat-label">Total Pendapatan</div><div className="dashboard-stat-value">{money.format(amountOf(todayItems.filter((item) => item.paymentStatus === "Lunas")))}</div><div className="dashboard-stat-hint positive">↗ Pembayaran lunas hari ini</div></div></article><article className="dashboard-stat"><span className="dashboard-stat-icon">▤</span><div><div className="dashboard-stat-label">Jumlah Transaksi</div><div className="dashboard-stat-value">{todayItems.length} Transaksi</div><div className="dashboard-stat-hint">Nota dibuat hari ini</div></div></article><article className="dashboard-stat"><span className="dashboard-stat-icon">◷</span><div><div className="dashboard-stat-label">Total Piutang</div><div className="dashboard-stat-value">{money.format(amountOf(unpaid))}</div><div className="dashboard-stat-hint">{unpaid.length} transaksi belum lunas</div></div></article></section>
          <section className="dashboard-tables">
            <article className="card dashboard-panel"><div className="section-heading"><div><h2>♟ &nbsp; Antrean Laundry</h2><p>{todayItems.filter((item) => item.workStatus === "Diproses").length} cucian sedang dalam proses</p></div><button className="button button-primary button-small" onClick={() => navigate("queue")}>Lihat Semua →</button></div><TransactionTable items={todayQueue} tariffs={tariffs} onDetail={setDetail} onComplete={(item) => void updateStatus(item, "workStatus")} onPay={(item) => setPayment(item)} compact /><div className="dashboard-table-footer"><span>{todayQueue.length} transaksi terbaru · {todayItems.filter((item) => item.workStatus === "Diproses").length} masih diproses</span><button className="button button-small button-quiet" onClick={() => navigate("kasir")}>＋ Transaksi</button></div></article>
            <article className="card dashboard-panel"><div className="section-heading"><div><h2>▤ &nbsp; Riwayat Transaksi</h2><p>Transaksi terbaru yang tercatat</p></div><button className="button button-primary button-small" onClick={() => navigate("history")}>Lihat Semua →</button></div>
              {recent.length ? <div className="table-wrap"><table><thead><tr><th>No.</th><th>ID transaksi</th><th>Pelanggan</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{recent.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><strong>{item.id}</strong><span className="subtext">{formatDate(item.createdAt)}</span></td><td><span className="customer">{item.customerName}</span></td><td><strong>{money.format(item.total)}</strong></td><td><StatusBadge value={item.paymentStatus} /></td><td><button className="button button-small button-primary" onClick={() => setDetail(item)}>Detail</button></td></tr>)}</tbody></table></div> : <EmptyState title="Belum ada riwayat" description="Nota terbaru akan tampil setelah transaksi dibuat." />}
              <div className="dashboard-table-footer"><span>Menampilkan {recent.length} transaksi terbaru</span><span>{transactions.length} total</span></div>
            </article>
          </section>
          <section className="dashboard-report">          <article className="card dashboard-report-card"><div className="dashboard-report-heading"><span className="dashboard-report-icon">▥</span><div><h2>Rekap Laporan</h2><p>Transaksi dikelompokkan per minggu kalender (Senin–Minggu)</p></div></div><div className="dashboard-report-actions"><input className="input" type="date" aria-label="Tanggal mulai laporan" value={reportStart} onChange={(event) => setReportStart(event.target.value)} /><span>—</span><input className="input" type="date" aria-label="Tanggal akhir laporan" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} /><button className="button button-primary" onClick={() => applyDateRange(reportStart, reportEnd, "report")}>Tampilkan</button><button className="button button-quiet" onClick={() => exportCsv("dashboard")}>⇩ Ekspor</button></div>{makeDashboardChart()}</article>
          <article className="card dashboard-report-card service-summary"><div className="dashboard-report-heading"><span className="dashboard-report-icon">◉</span><div><h2>Ringkasan Layanan</h2><p>Komposisi transaksi pada periode ini</p></div></div><div className="service-donut-row"><div className="service-donut" role="img" aria-label="Diagram komposisi layanan" style={{ background: `conic-gradient(#4d91eb 0 ${firstShare}%, #ffb900 ${firstShare}% ${secondShare}%, #ffe04f ${secondShare}% 100%)` }} /><div className="service-legend">{dashboardServices.map((service, index) => <div className="service-legend-row" key={service.id}><span className={`service-dot ${["blue", "orange", "yellow"][index]}`} /><span>{service.name.replace("Cuci ", "")}</span><strong>{reportItems.length ? Math.round(service.count / reportItems.length * 100) : 0}%</strong></div>)}{!reportItems.length && <span className="dashboard-empty-hint">Belum ada transaksi pada periode ini.</span>}</div></div></article></section>
          <div className="dashboard-footer"><span>Data diperbarui saat transaksi berubah.</span><button className="button button-small button-quiet" onClick={() => navigate("report")}>Buka laporan lengkap →</button></div>
        </div>}

        {page === "kasir" && <>
          <PageHeading eyebrow={dateLabel} title="Transaksi Baru" description="Masukkan data pelanggan dan layanan laundry." />
          <section className="card transaction-screen"><header className="transaction-heading"><span className="transaction-heading-icon">▤</span><div><h1>Transaksi Baru</h1><p>Masukkan data pelanggan dan layanan laundry</p></div></header>
            <form onSubmit={createTransaction}><div className="transaction-content"><div className="transaction-fields">
              <div className="field"><label htmlFor="customer-input">Nama Pelanggan <span aria-hidden="true">*</span></label><div className="transaction-input-wrap"><span className="transaction-input-icon">♟</span><input className="input" id="customer-input" maxLength={80} autoComplete="name" placeholder="Masukkan nama pelanggan" value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} required /></div></div>
              <div className="field"><label htmlFor="phone-input">Nomor WhatsApp <span className="help">(opsional)</span></label><div className="transaction-input-wrap"><span className="transaction-input-icon">☎</span><input className="input" id="phone-input" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="08xxxxxxxxxx" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div><small>Nomor digunakan untuk menghubungi pelanggan terkait pesanannya.</small></div>
              <div className="field"><label htmlFor="service-select">Jenis Layanan <span aria-hidden="true">*</span></label><div className="transaction-input-wrap"><span className="transaction-input-icon">▣</span><select className="select" id="service-select" value={draft.serviceId} onChange={(event) => setDraft({ ...draft, serviceId: event.target.value as ServiceId })}>{tariffs?.services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div></div>
              <div className="field"><label htmlFor="weight-input">Berat Pakaian (kg) <span aria-hidden="true">*</span></label><div className="transaction-input-wrap has-suffix"><span className="transaction-input-icon">⚖</span><input className="input" id="weight-input" inputMode="decimal" maxLength={12} placeholder="Masukkan berat pakaian" value={draft.weight} onChange={(event) => setDraft({ ...draft, weight: event.target.value })} required /><span className="input-suffix">kg</span></div><small>Maksimal dua angka di belakang koma, contoh: 3,45.</small></div>
              <div className="field"><label htmlFor="notes-input">Catatan <span className="help">(opsional)</span></label><div className="transaction-input-wrap textarea-wrap"><span className="transaction-input-icon">▤</span><textarea className="textarea" id="notes-input" maxLength={250} placeholder="Tambahkan catatan jika ada..." value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></div></div>
              <div className="check-row"><input id="express-input" type="checkbox" checked={draft.express} onChange={(event) => setDraft({ ...draft, express: event.target.checked })} /><label htmlFor="express-input">Layanan Express<small>Tambah biaya {money.format(tariffs?.expressFee ?? 0)} per transaksi</small></label></div>
            </div><aside className="transaction-summary" aria-live="polite"><div className="transaction-summary-heading"><span>▤</span><h2>Ringkasan Pesanan</h2></div><div className="transaction-summary-body"><div className="summary-row"><span>Jenis Layanan</span><strong className="summary-service">{tariffs?.services.find((service) => service.id === draft.serviceId)?.name ?? "Pilih layanan"}</strong></div><div className="summary-row"><span>Berat Pakaian</span><strong>{draft.weight || "0"} kg</strong></div><div className="summary-row"><span>Tarif per Kg</span><strong>{money.format(selectedRate)}</strong></div><div className="summary-row"><span>Biaya Express</span><strong>{money.format(draft.express ? tariffs?.expressFee ?? 0 : 0)}</strong></div><div className="summary-total"><span>Total Biaya</span><strong>{money.format(estimatedTotal)}</strong></div></div></aside></div>
              <div className="transaction-actions"><button className="button button-quiet" type="reset" onClick={() => setDraft({ customerName: "", phone: "", serviceId: "cuci-kering", weight: "", express: false, notes: "" })}>↻ &nbsp; Reset</button><button className="button button-primary" type="submit" disabled={saving || !tariffs}>▣ &nbsp; {saving ? "Menyimpan..." : "Simpan Transaksi"}</button></div>
            </form></section>
        </>}

        {page === "queue" && <>
          <PageHeading eyebrow="Operasional" title="Antrean Laundry" description="Pantau pengerjaan dan pembayaran setiap cucian."><button className="button button-primary" onClick={() => navigate("kasir")}>＋ Transaksi Baru</button></PageHeading>
          <div className="stats-grid"><article className="card stat-card"><div className="stat-icon">◉</div><div><div className="stat-label">Total Nilai Transaksi</div><div className="stat-value">{money.format(amountOf(transactions))}</div><div className="stat-hint">Akumulasi {transactions.length} transaksi</div></div></article><article className="card stat-card"><div className="stat-icon">▤</div><div><div className="stat-label">Transaksi Hari Ini</div><div className="stat-value">{todayItems.length} Transaksi</div><div className="stat-hint">Nota dibuat hari ini</div></div></article><article className="card stat-card"><div className="stat-icon">◷</div><div><div className="stat-label">Total Belum Dibayar</div><div className="stat-value">{money.format(amountOf(unpaid))}</div><div className="stat-hint">{unpaid.length} transaksi menunggu pembayaran</div></div></article></div>
          <section className="card card-pad"><div className="section-heading"><div><h2>Daftar Antrean</h2><p>Status pengerjaan dan pembayaran dikelola terpisah.</p></div></div><div className="toolbar"><div className="field search-field"><label htmlFor="queue-search">Cari pelanggan atau ID</label><input className="input" id="queue-search" placeholder="Ketik nama pelanggan atau nomor transaksi..." value={queueSearch} onChange={(event) => setQueueSearch(event.target.value)} /></div><div className="field"><label htmlFor="queue-work">Status pengerjaan</label><select className="select" id="queue-work" value={queueWork} onChange={(event) => setQueueWork(event.target.value)}><option value="">Semua status</option><option>Diproses</option><option>Selesai</option></select></div><div className="field"><label htmlFor="queue-payment">Pembayaran</label><select className="select" id="queue-payment" value={queuePayment} onChange={(event) => setQueuePayment(event.target.value)}><option value="">Semua pembayaran</option><option>Belum Bayar</option><option>Lunas</option></select></div><button className="button button-quiet" onClick={() => void refresh().catch((error: unknown) => setNotice({ message: error instanceof Error ? error.message : "Data belum dapat dimuat.", type: "error" }))}>↻ Refresh</button></div><TransactionTable items={queueItems} tariffs={tariffs} onDetail={setDetail} onComplete={(item) => void updateStatus(item, "workStatus")} onPay={setPayment} /><div className="table-footer"><span>Menampilkan {queueItems.length} transaksi</span><span>Aksi hanya mengubah status transaksi yang dipilih.</span></div></section>
        </>}

        {page === "history" && <div className="history-page"><PageHeading eyebrow="Data Transaksi" title="Riwayat Transaksi" description="Kelola dan pantau seluruh transaksi laundry." />
          <div className="history-date-filter"><div className="field"><label htmlFor="history-start">Tanggal Mulai</label><input className="input" id="history-start" type="date" value={historyStart} onChange={(event) => setHistoryStart(event.target.value)} /></div><div className="field"><label htmlFor="history-end">Tanggal Akhir</label><input className="input" id="history-end" type="date" value={historyEnd} onChange={(event) => setHistoryEnd(event.target.value)} /></div><button className="button button-primary" onClick={() => applyDateRange(historyStart, historyEnd, "history")}>⌕ &nbsp; Cari</button><button className="button button-quiet" onClick={() => { setHistoryStart(monthStart()); setHistoryEnd(todayString()); setAppliedHistory({ start: monthStart(), end: todayString() }); setHistorySearch(""); setHistoryStatus(""); setHistoryMethod(""); setHistoryPage(1); }}>↻ &nbsp; Reset</button></div>
          <section className="history-stats"><article className="history-stat"><span className="history-stat-icon">◉</span><div><div className="history-stat-label">Total Pendapatan</div><div className="history-stat-value">{money.format(amountOf(rangeHistory.filter((item) => item.paymentStatus === "Lunas")))}</div></div></article><article className="history-stat"><span className="history-stat-icon">▤</span><div><div className="history-stat-label">Jumlah Transaksi</div><div className="history-stat-value">{rangeHistory.length} Transaksi</div></div></article><article className="history-stat"><span className="history-stat-icon">◷</span><div><div className="history-stat-label">Total Piutang</div><div className="history-stat-value">{money.format(amountOf(rangeHistory.filter((item) => item.paymentStatus === "Belum Bayar")))}</div></div></article></section>
          <section className="card history-table-card"><div className="history-controls"><div className="field search-field"><label htmlFor="history-search">Pencarian</label><div className="history-search-wrap"><span>⌕</span><input className="input" id="history-search" placeholder="Cari ID Transaksi atau Nama Pelanggan..." value={historySearch} onChange={(event) => { setHistorySearch(event.target.value); setHistoryPage(1); }} /></div></div><div className="field"><label htmlFor="history-status">Status</label><select className="select" id="history-status" value={historyStatus} onChange={(event) => { setHistoryStatus(event.target.value); setHistoryPage(1); }}><option value="">Semua</option><option value="Lunas">Lunas</option><option value="Belum Bayar">Belum Lunas</option></select></div><div className="field"><label htmlFor="history-method">Metode Bayar</label><select className="select" id="history-method" value={historyMethod} onChange={(event) => { setHistoryMethod(event.target.value); setHistoryPage(1); }}><option value="">Semua</option>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div><button className="button button-primary history-export" onClick={() => exportCsv("history")}>⇩ &nbsp; Ekspor</button></div>
            {historyItems.length ? <div className="table-wrap"><table><thead><tr><th>No.</th><th>ID Transaksi</th><th>Tanggal</th><th>Pelanggan</th><th>Total</th><th>Status</th><th>Metode Bayar</th><th>Aksi</th></tr></thead><tbody>{historyItems.map((item, index) => <tr key={item.id}><td>{(historyPage - 1) * 5 + index + 1}</td><td><strong>{item.id}</strong></td><td>{formatDate(item.createdAt)}</td><td><span className="customer">{item.customerName}</span></td><td><strong>{money.format(item.total)}</strong></td><td><StatusBadge value={item.paymentStatus} /></td><td><span className="payment-method">{item.paymentMethod || "—"}</span></td><td><button className="button button-primary button-small" onClick={() => setDetail(item)}>◉ &nbsp; Detail</button></td></tr>)}</tbody></table></div> : <EmptyState title="Tidak ada transaksi pada filter ini" description="Ubah rentang tanggal atau kata kunci pencarian." />}
            <div className="history-pagination"><span>Menampilkan {filteredHistory.length ? (historyPage - 1) * 5 + 1 : 0}–{Math.min(historyPage * 5, filteredHistory.length)} dari {filteredHistory.length} transaksi</span><div className="history-page-buttons" aria-label="Navigasi halaman riwayat"><button disabled={historyPage <= 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}>‹</button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, Math.min(historyPage - 3, pageCount - 5)), Math.max(5, historyPage + 2)).map((number) => <button key={number} className={historyPage === number ? "active" : ""} aria-current={historyPage === number ? "page" : undefined} onClick={() => setHistoryPage(number)}>{number}</button>)}<button disabled={historyPage >= pageCount} onClick={() => setHistoryPage((current) => Math.min(pageCount, current + 1))}>›</button></div></div>
          </section>
        </div>}

        {page === "report" && <><PageHeading eyebrow="Analitik" title="Rekap Laporan" description="Ringkasan transaksi dan pembayaran dalam periode pilihan." /><section className="card card-pad"><div className="toolbar"><div className="field"><label htmlFor="report-start">Tanggal mulai</label><input className="input" type="date" id="report-start" value={reportStart} onChange={(event) => setReportStart(event.target.value)} /></div><div className="field"><label htmlFor="report-end">Tanggal akhir</label><input className="input" type="date" id="report-end" value={reportEnd} onChange={(event) => setReportEnd(event.target.value)} /></div><button className="button button-primary" onClick={() => applyDateRange(reportStart, reportEnd, "report")}>Tampilkan</button><button className="button button-quiet" onClick={() => exportCsv("report")}>⇩ Ekspor CSV</button></div><div className="report-summary"><div className="report-stat"><span>Nilai transaksi</span><strong>{money.format(amountOf(reportItems))}</strong></div><div className="report-stat"><span>Pembayaran lunas</span><strong>{money.format(amountOf(reportItems.filter((item) => item.paymentStatus === "Lunas")))}</strong></div><div className="report-stat"><span>Belum dibayar</span><strong>{money.format(amountOf(reportItems.filter((item) => item.paymentStatus === "Belum Bayar")))}</strong></div></div><div className="section-heading"><div><h2>Aktivitas 7 hari terakhir</h2><p>Nilai transaksi berdasarkan tanggal nota dibuat.</p></div></div>{makeChart(transactions)}<div className="dashboard-lower"><div><h2>Ringkasan layanan</h2><div className="table-wrap"><table><thead><tr><th>Layanan</th><th>Transaksi</th><th>Nilai</th></tr></thead><tbody>{serviceSummary(reportItems).map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.count}</td><td>{money.format(item.total)}</td></tr>)}</tbody></table></div></div><div><h2>Status pengerjaan</h2><div className="report-stat"><span>Selesai</span><strong>{reportItems.filter((item) => item.workStatus === "Selesai").length} transaksi</strong></div><div className="report-stat" style={{ marginTop: 10 }}><span>Diproses</span><strong>{reportItems.filter((item) => item.workStatus === "Diproses").length} transaksi</strong></div></div></div><p className="footer-note">Laporan menghitung nilai transaksi pada tanggal nota dibuat. Nilai lunas dan belum dibayar dipisahkan berdasarkan status pembayaran saat ini.</p></section></>}

        {page === "settings" && <><PageHeading eyebrow="Konfigurasi" title="Pengaturan Tarif" description="Atur tarif per kilogram dan biaya layanan ekspres." />{rateDraft && <form className="settings-grid" onSubmit={saveRates}><section className="card"><div className="settings-section-heading"><span className="settings-icon">◈</span><h2>Tarif layanan</h2></div><p className="intro">Tarif baru hanya berlaku untuk transaksi berikutnya. Nilai transaksi yang sudah tersimpan tidak berubah.</p>{rateDraft.services.map((service) => <div className="service-rate" key={service.id}><div><strong>{service.name}</strong><small>Tarif per kilogram</small></div><label className="rate-input"><span>Rp</span><input type="number" min="0" step="500" value={service.pricePerKg} aria-label={`Tarif ${service.name} per kilogram`} onChange={(event) => setRateDraft({ ...rateDraft, services: rateDraft.services.map((item) => item.id === service.id ? { ...item, pricePerKg: Number(event.target.value) } : item) })} /></label></div>)}</section><section className="card"><div className="settings-section-heading"><span className="settings-icon">✦</span><h2>Biaya tambahan</h2></div><p className="intro">Biaya ekspres ditambahkan sekali per transaksi, bukan dikalikan berat.</p><div className="service-rate"><div><strong>Layanan ekspres</strong><small>Biaya tambahan per transaksi</small></div><label className="rate-input"><span>Rp</span><input type="number" min="0" step="500" value={rateDraft.expressFee} aria-label="Biaya layanan ekspres" onChange={(event) => setRateDraft({ ...rateDraft, expressFee: Number(event.target.value) })} /></label></div><div className="settings-save"><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</button></div><p className="footer-note">Tarif usaha yang disimpan akan digunakan untuk transaksi berikutnya.</p></section></form>}</>}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Navigasi mobile">{navigation.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => navigate(item.id)}><span aria-hidden="true">{item.icon}</span><span>{item.shortLabel}</span></button>)}</nav>
    <dialog ref={detailDialog} id="transaction-detail-dialog" aria-label="Detail transaksi" onClick={(event) => { if (event.target === event.currentTarget) { detailDialog.current?.close(); setDetail(null); } }} onClose={() => setDetail(null)}>
      {detail && <div className="detail-dialog"><button className="detail-close" aria-label="Tutup detail" onClick={() => detailDialog.current?.close()}>×</button><div className="eyebrow">Detail nota</div><h2>{detail.id}</h2><p className="detail-date">Dibuat {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(detail.createdAt))}</p><div className="detail-grid"><span>Pelanggan</span><strong>{detail.customerName}</strong>{detail.phone && <><span>WhatsApp</span><strong>{detail.phone}</strong></>}<span>Jenis layanan</span><strong>{serviceName(detail, tariffs)}</strong><span>Berat pakaian</span><strong>{Number(detail.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</strong><span>Tarif per kg</span><strong>{money.format(detail.unitRate ?? tariffs?.services.find((service) => service.id === detail.serviceId)?.pricePerKg ?? 0)}</strong><span>Layanan ekspres</span><strong>{detail.express ? money.format(detail.expressFee ?? tariffs?.expressFee ?? 0) : "Tidak"}</strong><span>Status pengerjaan</span><strong>{detail.workStatus}</strong><span>Status pembayaran</span><strong>{detail.paymentStatus}</strong>{detail.paymentMethod && <><span>Metode bayar</span><strong>{detail.paymentMethod}</strong></>}{detail.notes && <><span>Catatan</span><strong>{detail.notes}</strong></>}</div><div className="detail-total"><span>Total biaya</span><strong>{money.format(detail.total)}</strong></div><button className="button button-primary detail-done" onClick={() => detailDialog.current?.close()}>Tutup</button></div>}
    </dialog>
    <dialog ref={paymentDialog} id="payment-method-dialog" aria-label="Pilih metode pembayaran" onClick={(event) => { if (event.target === event.currentTarget) { paymentDialog.current?.close(); setPayment(null); } }} onClose={() => setPayment(null)}>
      {payment && <div className="detail-dialog"><button className="detail-close" aria-label="Tutup" onClick={() => paymentDialog.current?.close()}>×</button><div className="eyebrow">Pembayaran transaksi</div><h2>{payment.id}</h2><p className="detail-date">Pilih metode pembayaran untuk {payment.customerName}.</p><div className="field"><label htmlFor="payment-method-select">Metode bayar</label><select className="select" id="payment-method-select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></div><div className="payment-dialog-actions"><button className="button button-quiet" onClick={() => paymentDialog.current?.close()}>Batal</button><button className="button button-primary" disabled={busyId === payment.id} onClick={() => void updateStatus(payment, "paymentStatus", paymentMethod)}>Konfirmasi Lunas</button></div></div>}
    </dialog>
    <dialog ref={trackingDialog} className="tracking-dialog" aria-label="Kode pelacakan transaksi" onClick={(event) => { if (event.target === event.currentTarget) trackingDialog.current?.close(); }} onClose={() => setTrackingReceipt(null)}>
      {trackingReceipt && <div className="detail-dialog tracking-receipt">
        <button className="detail-close no-print" aria-label="Tutup struk" onClick={() => trackingDialog.current?.close()}>×</button>
        <div className="receipt-brand"><Image src="/laundry-logo.png" alt="Logo Londri Kece" width={62} height={62} priority /><div><strong>Londri Kece</strong><span>Bersih, Wangi, Harga Terjangkau</span></div></div>
        <div className="receipt-title"><span>STRUK TRANSAKSI</span><strong>{trackingReceipt.transaction.id}</strong><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date(trackingReceipt.transaction.createdAt))}</small></div>
        <div className="receipt-lines">
          <div><span>Nama pelanggan</span><strong>{trackingReceipt.transaction.customerName}</strong></div>
          {trackingReceipt.transaction.phone && <div><span>WhatsApp</span><strong>{trackingReceipt.transaction.phone}</strong></div>}
          <div><span>Layanan</span><strong>{serviceName(trackingReceipt.transaction, tariffs)}</strong></div>
          <div><span>Berat pakaian</span><strong>{Number(trackingReceipt.transaction.weight).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg</strong></div>
          <div><span>Tarif per kg</span><strong>{money.format(trackingReceipt.transaction.unitRate ?? tariffs?.services.find((service) => service.id === trackingReceipt.transaction.serviceId)?.pricePerKg ?? 0)}</strong></div>
          {trackingReceipt.transaction.express && <div><span>Biaya ekspres</span><strong>{money.format(trackingReceipt.transaction.expressFee ?? tariffs?.expressFee ?? 0)}</strong></div>}
          <div className="receipt-total"><span>Total</span><strong>{money.format(trackingReceipt.transaction.total)}</strong></div>
          <div><span>Pembayaran</span><strong>{trackingReceipt.transaction.paymentStatus}</strong></div>
        </div>
        <div className="receipt-tracking">
          <span className="tracking-code-label">KODE CEK STATUS CUCIAN</span>
          <strong className="tracking-code">{trackingReceipt.transaction.trackingCode}</strong>
          <p>Masukkan kode enam angka ini di halaman pelanggan untuk melihat status cucian.</p>
          {trackingReceipt.qrCode && <Image className="tracking-qr" src={trackingReceipt.qrCode} alt="QR menuju halaman pelanggan untuk memasukkan kode" width={150} height={150} unoptimized />}
          <span className="receipt-customer-url">{trackingReceipt.url}</span>
        </div>
        <p className="receipt-thanks">Terima kasih telah menggunakan layanan Londri Kece.</p>
        <div className="tracking-receipt-actions no-print">
          <button className="button button-quiet" onClick={() => void copyTrackingLink()}>Salin tautan pelanggan</button>
          <button className="button button-primary" onClick={() => window.print()}>Cetak Struk</button>
          <button className="button button-quiet" onClick={() => trackingDialog.current?.close()}>Selesai</button>
        </div>
      </div>}
    </dialog>
  </div>;
}
