"use client";
import { useState } from "react";

export default function PembersihanPage() {
  const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); const response = await fetch("/api/cleanup-demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm }) }); const result = await response.json() as { error?: string; message?: string }; setBusy(false); setMessage(response.ok ? result.message || "Selesai." : result.error || "Gagal membersihkan data."); if (response.ok) setConfirm(""); }
  return <main style={{maxWidth:720,margin:"60px auto",padding:24,fontFamily:"Arial,sans-serif"}}><h1>Pembersihan Data Demo</h1><p>Gunakan setelah data pesantren asli siap. Hanya fixture demo berpenanda SN-240 dan PSB-260 yang dihapus; akun pengguna internal/admin tetap aman.</p><form onSubmit={submit}><label style={{display:"block",fontWeight:700,margin:"24px 0 8px"}}>Ketik HAPUS DATA DEMO untuk konfirmasi<input value={confirm} onChange={event=>setConfirm(event.target.value)} style={{display:"block",width:"100%",padding:12,marginTop:8}} /></label><button disabled={busy || confirm !== "HAPUS DATA DEMO"} style={{padding:"12px 18px",background:"#b42318",color:"white",border:0,borderRadius:8}}>{busy ? "Membersihkan…" : "Hapus data demo"}</button></form>{message && <p style={{marginTop:20,fontWeight:700}}>{message}</p>}</main>;
}
