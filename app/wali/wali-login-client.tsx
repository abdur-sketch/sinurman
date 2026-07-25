"use client";

import { useEffect, useState } from "react";

export default function GuardianLoginClient() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activePhone, setActivePhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/wali-auth", { cache: "no-store" })
        .then(response => response.json())
        .then(resultValue => {
          const result = resultValue as { authenticated?:boolean; phone?:string };
          setAuthenticated(Boolean(result.authenticated));
          setActivePhone(String(result.phone ?? ""));
        })
        .finally(() => setChecking(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/wali-auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const result = await response.json() as { error?:string; redirectTo?:string };
      if (!response.ok) throw new Error(result.error || "Gagal masuk.");
      window.location.assign(result.redirectTo || "/portal-wali");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal masuk.");
      setLoading(false);
    }
  }

  if (checking) {
    return <div className="guardian-login-form guardian-login-checking">Memeriksa sesi Portal Wali…</div>;
  }

  if (authenticated) {
    return <div className="guardian-login-session guardian-phone-session">
      <span>Portal Wali sudah aktif</span>
      <strong>+{activePhone}</strong>
      <small>Sesi aman tersimpan pada perangkat ini.</small>
      <a className="primary-button link-button" href="/portal-wali">Buka Portal Wali →</a>
    </div>;
  }

  return <form className="guardian-login-form" onSubmit={submit}>
    <label>Nomor HP / WhatsApp
      <div className="guardian-phone-input"><span>+62</span><input required inputMode="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="812 3456 7890" /></div>
    </label>
    <label>PIN Portal Wali
      <input required inputMode="numeric" autoComplete="current-password" minLength={6} maxLength={6} pattern="[0-9]{6}" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6 angka" />
    </label>
    {error && <div className="form-error">{error}</div>}
    <button className="primary-button guardian-login-primary" disabled={loading}>{loading ? "Memeriksa…" : "Masuk ke Portal Wali →"}</button>
    <small>PIN dibuat oleh Admin pesantren dan tidak boleh dibagikan kepada orang lain.</small>
  </form>;
}
