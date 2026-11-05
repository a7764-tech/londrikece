"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type Tracking = { customerName: string; status: "Diproses" | "Selesai"; serviceName: string; createdAt: string };

export default function TrackingStatus({ code }: { code: string }) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/track/${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Status cucian belum dapat dimuat.");
      setTracking(data);
      setError("");
      setCheckedAt(new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Status cucian belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    const initial = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const isComplete = tracking?.status === "Selesai";

  return <main className="tracking-page customer-page">
    <header className="tracking-header">
      <Image src="/laundry-logo.png" alt="Logo Londri Kece" width={58} height={58} priority />
      <div className="tracking-brand-copy"><strong>Londri Kece</strong><span>Laundry yang bersih dan wangi</span></div>
      <span className="tracking-header-badge"><span aria-hidden="true">●</span> Portal pelanggan</span>
    </header>
    <section className="tracking-card tracking-status-card">
      <div className="tracking-card-heading">
        <span className="tracking-eyebrow"><span aria-hidden="true">✦</span> PELACAKAN PESANAN</span>
        <h1>Status cucian Anda</h1>
        <p className="tracking-intro">Pantau proses laundry Anda dengan mudah. Status akan diperbarui otomatis.</p>
      </div>
      {loading && <div className="tracking-message" role="status"><span className="tracking-loading-dot" />Memuat status cucian...</div>}
      {!loading && error && <div className="tracking-message tracking-error" role="alert"><span aria-hidden="true">!</span>{error}</div>}
      {!loading && tracking && <>
        <div className={`tracking-status ${isComplete ? "tracking-complete" : ""}`}>
          <span className="tracking-status-icon" aria-hidden="true">{isComplete ? "✓" : "◷"}</span>
          <div><span>STATUS PENGERJAAN</span><strong>{isComplete ? "Cucian siap diambil!" : "Cucian sedang diproses"}</strong></div>
          <span className="tracking-status-pill">{isComplete ? "Selesai" : "Diproses"}</span>
        </div>
        <div className="tracking-customer">
          <span className="tracking-customer-avatar" aria-hidden="true">{tracking.customerName.trim().charAt(0).toUpperCase()}</span>
          <div><span>Pesanan untuk</span><strong>{tracking.customerName}</strong></div>
          <span className="tracking-customer-check" aria-label="Pesanan terverifikasi">✓</span>
        </div>
        <div className={`tracking-progress ${isComplete ? "tracking-progress-complete" : ""}`} aria-label={`Tahapan cucian: ${isComplete ? "selesai" : "sedang diproses"}`}>
          <div className="tracking-progress-step tracking-step-done"><span>✓</span><div><strong>Pesanan diterima</strong><small>Sudah kami terima</small></div></div>
          <div className={`tracking-progress-step ${isComplete ? "tracking-step-done" : "tracking-step-current"}`}><span>{isComplete ? "✓" : "2"}</span><div><strong>Proses laundry</strong><small>{isComplete ? "Proses selesai" : "Sedang dikerjakan"}</small></div></div>
          <div className={`tracking-progress-step ${isComplete ? "tracking-step-done" : ""}`}><span>{isComplete ? "✓" : "3"}</span><div><strong>Siap diambil</strong><small>{isComplete ? "Silakan datang ke toko" : "Menunggu proses selesai"}</small></div></div>
        </div>
        <div className="tracking-details">
          <div><span>Jenis layanan</span><strong>{tracking.serviceName}</strong></div>
          <div><span>Tanggal diterima</span><strong>{new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(tracking.createdAt))}</strong></div>
        </div>
        <div className="tracking-status-actions">
          <p className="tracking-refresh"><span aria-hidden="true">↻</span> Diperbarui otomatis · terakhir dicek {checkedAt}</p>
          <button className="button button-quiet tracking-refresh-button" onClick={() => { setLoading(true); void refresh(); }}>Perbarui status</button>
        </div>
      </>}
    </section>
    <a className="tracking-lookup-link" href="/cek-status"><span aria-hidden="true">←</span> Cek status dengan kode lain</a>
    <p className="tracking-footer"><span aria-hidden="true">♡</span> Terima kasih telah mempercayakan pakaian Anda kepada Londri Kece.</p>
  </main>;
}
