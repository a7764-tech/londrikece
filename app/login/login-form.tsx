"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Login belum berhasil. Periksa kembali data Anda.");
        return;
      }
      setUsername("");
      setPassword("");
      router.replace("/");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-page">
    <div className="login-bubble login-bubble-one" aria-hidden="true" />
    <div className="login-bubble login-bubble-two" aria-hidden="true" />
    <div className="login-bubble login-bubble-three" aria-hidden="true" />
    <div className="login-sunburst" aria-hidden="true">✦</div>
    <div className="login-side-art login-side-art-left" aria-hidden="true">
      <span className="login-wash-word">WASH</span>
      <div className="login-machine"><span className="login-machine-panel"><i /><i /><i /></span><span className="login-machine-door"><i /></span><span className="login-machine-foot" /></div>
      <span className="login-laundry-basket">🧺</span>
      <span className="login-shirt">👕</span>
      <span className="login-spark login-spark-one">✦</span>
    </div>
    <div className="login-side-art login-side-art-right" aria-hidden="true">
      <span className="login-wash-word">FRESH</span>
      <div className="login-machine"><span className="login-machine-panel"><i /><i /><i /></span><span className="login-machine-door"><i /></span><span className="login-machine-foot" /></div>
      <span className="login-laundry-basket">🧺</span>
      <span className="login-shirt">🧦</span>
      <span className="login-spark login-spark-two">✦</span>
    </div>

    <section className="login-card" aria-labelledby="login-title">
      <div className="login-brand">
        <Image src="/laundry-logo.png" alt="Logo Londri Kece" width={104} height={104} priority />
        <span className="login-brand-title">LAUNDRY</span>
        <span className="login-brand-subtitle">MANAGEMENT SYSTEM</span>
        <span className="login-brand-caption">KASIR · ANTREAN · TRANSAKSI · LAPORAN</span>
      </div>
      <h1 id="login-title" className="login-title">Login Kasir</h1>
      <p className="login-description">Masuk untuk mengelola transaksi laundry</p>
      <form className="login-form" onSubmit={submit}>
        <label className="login-field">
          <span className="login-field-icon" aria-hidden="true">♟</span>
          <span className="visually-hidden">Username</span>
          <input
            autoComplete="username"
            autoCapitalize="none"
            name="username"
            placeholder="Username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="login-field">
          <span className="login-field-icon login-lock-icon" aria-hidden="true">▣</span>
          <span className="visually-hidden">Password</span>
          <input
            autoComplete="current-password"
            name="password"
            placeholder="Password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button className="login-submit" type="submit" disabled={loading}>
          <span aria-hidden="true">{loading ? "◌" : "↪"}</span>
          {loading ? "Memeriksa..." : "Login"}
        </button>
      </form>
      <div className="login-help">
        <span />
        <span>Lupa password? <button type="button" onClick={() => setShowHelp((visible) => !visible)}>Klik di sini</button></span>
        <span />
      </div>
      {showHelp && <p className="login-help-message" role="status">Hubungi administrator untuk mengganti password melalui konfigurasi server.</p>}
      <p className="login-footer">Bersih, Wangi, Harga Terjangkau</p>
    </section>
    <p className="login-page-footer">© Londri Kece · Laundry yang bikin hari lebih cerah</p>
  </main>;
}
