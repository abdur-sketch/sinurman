"use client";

import { useEffect, useState } from "react";

export default function GuardianLoginClient() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activePhone, setActivePhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  async function register(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      if (pin !== confirmation) throw new Error("Ulangi PIN dengan angka yang sama.");
      const response = await fetch("/api/wali-register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const result = await response.json() as { error?:string; message?:string };
      if (!response.ok) throw new Error(result.error || "Pendaftaran akun gagal.");
      setMessage(result.message || "Pendaftaran terkirim dan menunggu persetujuan Admin.");
      setPin("");
      setConfirmation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Pendaftaran akun gagal.");
    } finally {
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

  return <div className="guardian-auth-box">
    <div className="guardian-auth-tabs">
      <button type="button" className={mode==="login"?"active":""} onClick={()=>{setMode("login");setError("");setMessage("");}}>Masuk</button>
      <button type="button" className={mode==="register"?"active":""} onClick={()=>{setMode("register");setError("");setMessage("");}}>Daftar Akun Wali</button>
    </div>
  <form className={`guardian-login-form ${mode==="register"?"guardian-register-form":""}`} onSubmit={mode==="login"?submit:register}>
    <label>Nomor HP / WhatsApp
      <div className="guardian-phone-input"><span>+62</span><input required inputMode="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="812 3456 7890" /></div>
    </label>
    <label>PIN Portal Wali
      <input required inputMode="numeric" autoComplete={mode==="login"?"current-password":"new-password"} minLength={6} maxLength={6} pattern="[0-9]{6}" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6 angka" />
    </label>
    {mode==="register"&&<label>Ulangi PIN
      <input required inputMode="numeric" autoComplete="new-password" minLength={6} maxLength={6} pattern="[0-9]{6}" value={confirmation} onChange={event=>setConfirmation(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Ulangi 6 angka" />
    </label>}
    {error && <div className="form-error">{error}</div>}
    {message && <div className="form-success">{message}</div>}
    <button className="primary-button guardian-login-primary" disabled={loading}>{loading ? "Memproses…" : mode==="login" ? "Masuk ke Portal Wali →" : "Kirim Pendaftaran Akun →"}</button>
    <small>{mode==="login"?"Gunakan nomor HP yang terdaftar dan PIN 6 angka Anda.":"Nomor HP harus sama dengan Data Santri. Akun aktif setelah disetujui Admin."}</small>
  </form>
  </div>;
}
