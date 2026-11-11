"use client";

import { useState } from "react";
import BrandMark from "../../brand-mark";

type Portal = { admission: Record<string, unknown>; documents: Record<string, unknown>[]; timeline: { label: string; state: string }[] };

export default function SpmbTrackPage() {
  const [registrationNo, setRegistrationNo] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [portal, setPortal] = useState<Portal | null>(null);
  const [step, setStep] = useState<"number" | "otp">("number");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/spmb/track/start", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ registrationNo }) });
    const result = await response.json() as { challengeId?: string; error?: string };
    setBusy(false);
    if (!response.ok) { setError(result.error || "Permintaan belum dapat diproses."); return; }
    if (!result.challengeId) { setError("OTP belum tersedia. Hubungi panitia SPMB untuk bantuan."); return; }
    setChallengeId(result.challengeId); setStep("otp");
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/spmb/track/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, code }) });
    if (!response.ok) { const result = await response.json() as { error?: string }; setBusy(false); setError(result.error || "OTP tidak valid."); return; }
    const status = await fetch("/api/spmb/track/status", { cache: "no-store" });
    const result = await status.json() as Portal & { error?: string };
    setBusy(false);
    if (!status.ok) { setError(result.error || "Status belum dapat dimuat."); return; }
    setPortal(result);
  }

  async function logout() {
    await fetch("/api/spmb/track/logout", { method: "POST" });
    setPortal(null); setStep("number"); setCode(""); setChallengeId("");
  }

  return <main className="public-ppdb">
    <header className="ppdb-public-header"><a className="ppdb-public-brand" href="/ppdb"><BrandMark /><div><strong>SINURMAN</strong><small>SPMB Pondok Pesantren Nurul Iman</small></div></a><a className="secondary-button link-button" href="/ppdb">← Kembali ke SPMB</a></header>
    <section className="ppdb-public-panel spmb-track-panel"><span>SPMB PONDOK PESANTREN NURUL IMAN</span><h1>Lacak Status Pendaftaran</h1><p>Pantau perkembangan pendaftaran Ananda dengan aman menggunakan OTP ke nomor wali yang terdaftar.</p>
      {!portal && step === "number" && <form className="ppdb-status-form" onSubmit={start}><label>Nomor pendaftaran<input required value={registrationNo} onChange={event => setRegistrationNo(event.target.value.toUpperCase())} placeholder="PPDB-2026-XXXXXXXX" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Memeriksa…" : "Lanjutkan"}</button></form>}
      {!portal && step === "otp" && <form className="ppdb-status-form" onSubmit={verify}><p>Kode OTP dikirim ke nomor WhatsApp wali yang tercatat. Kode berlaku 5 menit.</p><label>Kode OTP<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 digit OTP" /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={busy}>{busy ? "Memverifikasi…" : "Verifikasi dan Lihat Status"}</button><button type="button" className="secondary-button" onClick={() => { setStep("number"); setError(""); }}>Ganti nomor pendaftaran</button></form>}
      {portal && <section className="ppdb-status-result"><header><div><small>{String(portal.admission.registration_no)}</small><h2>{String(portal.admission.name)}</h2></div><b>{String(portal.admission.status)}</b></header><p>{String(portal.admission.desired_level)} · Gelombang {String(portal.admission.wave || "-")}</p><small>Terakhir diperbarui: {new Date().toLocaleString("id-ID")}</small><div className="spmb-timeline">{portal.timeline.map(item => <article key={item.label}><i>{item.state === "Selesai" ? "✓" : item.state === "Perlu Tindakan" ? "!" : "·"}</i><div><strong>{item.label}</strong><span>{item.state}</span></div></article>)}</div><h3>Dokumen Pendaftaran</h3>{portal.documents.map(doc => <div className="portal-list" key={String(doc.id)}><strong>{String(doc.doc_type)}</strong><span>{String(doc.status)}</span></div>)}{Boolean(portal.admission.test_date) && <div className="ppdb-test-schedule"><strong>Jadwal Seleksi</strong><span>{String(portal.admission.test_date)} · {String(portal.admission.test_time || "")} · {String(portal.admission.test_location || "")}</span></div>}<a className="primary-button link-button" href="/spmb/tes">Buka Soal Tes</a><button className="secondary-button" onClick={() => void logout()}>Keluar dari portal</button></section>}
    </section><footer className="ppdb-public-footer">Butuh bantuan? Hubungi panitia SPMB Pondok Pesantren Nurul Iman.</footer>
  </main>;
}
