"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export default function TrackingLookupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Masukkan kode yang terdiri dari enam angka.");
      return;
    }
    setError("");
    router.push(`/status/${code}`);
  }

  return <main className="tracking-page customer-page">
    <header className="tracking-header">
      <Image src="/laundry-logo.png" alt="Logo Londri Kece" width={58} height={58} priority />
      <div className="tracking-brand-copy"><strong>Londri Kece</strong><span>Laundry yang bersih dan wangi</span></div>
      <span className="tracking-header-badge"><span aria-hidden="true">●</span> Portal pelanggan</span>
    </header>
    <section className="tracking-card tracking-lookup-card">
      <div className="tracking-card-heading">
        <span className="tracking-eyebrow"><span aria-hidden="true">✦</span> LAYANAN PELANGGAN</span>
        <h1>Cek status cucian</h1>
        <p className="tracking-intro">Cari tahu sampai mana proses laundry Anda. Cukup masukkan kode yang tercetak pada struk.</p>
      </div>
      <form className="tracking-code-form" onSubmit={submitCode}>
        <label htmlFor="tracking-code-input">KODE PELACAKAN</label>
        <input
          autoComplete="one-time-code"
          id="tracking-code-input"
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder="123456"
          value={code}
          onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
          required
        />
        <span className="tracking-code-hint">Masukkan 6 angka yang tertera pada struk transaksi</span>
        <button className="button button-primary" type="submit" disabled={code.length !== 6}><span aria-hidden="true">⌕</span> Cek status cucian</button>
      </form>
      {error && <div className="tracking-message tracking-error" role="alert">{error}</div>}
      <div className="tracking-steps">
        <div><span>1</span><p><strong>Lihat struk</strong><small>Temukan kode 6 angka</small></p></div>
        <div><span>2</span><p><strong>Masukkan kode</strong><small>Ketik kode pada kolom</small></p></div>
        <div><span>3</span><p><strong>Pantau cucian</strong><small>Lihat progres terbaru</small></p></div>
      </div>
    </section>
    <p className="tracking-footer"><span aria-hidden="true">♡</span> Kode tidak terbaca? Silakan hubungi langsung Londri Kece.</p>
  </main>;
}
