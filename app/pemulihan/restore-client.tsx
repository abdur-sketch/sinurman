"use client";

import { useEffect,useState } from "react";
import Link from "next/link";
import BrandMark from "../brand-mark";

export default function RestoreClient(){
  const [backup,setBackup]=useState<Record<string,unknown>|null>(null);
  const [counts,setCounts]=useState<Record<string,number>>({});
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [confirmation,setConfirmation]=useState("");
  useEffect(()=>{void fetch("/api/bootstrap",{cache:"no-store"}).then(async response=>{const result=await response.json() as {user?:{role?:string};error?:string};if(!response.ok||result.user?.role!=="Admin")throw new Error(result.error||"Pemulihan hanya tersedia untuk Admin.");}).catch(caught=>setError(caught instanceof Error?caught.message:"Akses ditolak.")).finally(()=>setLoading(false));},[]);
  async function inspect(file:File){setWorking(true);setError("");setMessage("");try{const value=JSON.parse(await file.text()) as Record<string,unknown>;const response=await fetch("/api/backup",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({backup:value})});const result=await response.json() as {error?:string;counts?:Record<string,number>;message?:string};if(!response.ok)throw new Error(result.error||"Backup tidak valid.");setBackup(value);setCounts(result.counts||{});setMessage(result.message||"Backup valid dan siap dipulihkan.");}catch(caught){setBackup(null);setCounts({});setError(caught instanceof Error?caught.message:"Backup gagal dibaca.");}finally{setWorking(false);}}
  async function restore(){if(!backup||confirmation!=="PULIHKAN"||!window.confirm("Data saat ini akan diganti dengan isi backup. Lanjutkan?"))return;setWorking(true);setError("");try{const response=await fetch("/api/backup",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({confirm:"PULIHKAN",backup})});const result=await response.json() as {error?:string;message?:string};if(!response.ok)throw new Error(result.error||"Pemulihan gagal.");setConfirmation("");setMessage(result.message||"Data berhasil dipulihkan.");}catch(caught){setError(caught instanceof Error?caught.message:"Pemulihan gagal.");}finally{setWorking(false);}}
  const total=Object.values(counts).reduce((sum,value)=>sum+value,0);
  return <main className="restore-page"><header><BrandMark/><div><strong>Pemulihan Data SINURMAN</strong><small>Validasi backup sebelum mengganti data produksi</small></div><Link href="/">Kembali ke Dashboard</Link></header><section className="card restore-card"><span className="modal-eyebrow">ADMINISTRASI SISTEM</span><h1>Backup & Pemulihan</h1><p>Sistem memeriksa struktur dan jumlah record terlebih dahulu. Pemulihan hanya berjalan setelah konfirmasi kedua.</p>{loading?<div className="portal-empty">Memeriksa akses Admin…</div>:!error&&<label className="upload-button">{working?"Memeriksa…":"Pilih Backup JSON"}<input type="file" accept="application/json,.json" disabled={working} onChange={event=>event.target.files?.[0]&&void inspect(event.target.files[0])}/></label>}{error&&<div className="form-error">{error}</div>}{message&&<div className="form-success">{message}</div>}{backup&&<><div className="restore-summary"><strong>{total.toLocaleString("id-ID")} record siap dipulihkan</strong><small>{Object.entries(counts).filter(([,value])=>value>0).map(([key,value])=>`${key}: ${value}`).join(" · ")}</small></div><label className="restore-confirmation">Ketik PULIHKAN untuk konfirmasi<input value={confirmation} onChange={event=>setConfirmation(event.target.value.toUpperCase())} autoComplete="off"/></label><button className="danger-button" disabled={working||confirmation!=="PULIHKAN"} onClick={()=>void restore()}>{working?"Memulihkan…":"Pulihkan Data Sekarang"}</button></>}</section></main>;
}
