"use client";

import { useState } from "react";
import BrandMark from "../brand-mark";

const documentTypes = ["Kartu Keluarga","Akta Kelahiran","Rapor Terakhir","Pas Foto","KIP / SKTM"];
type Result = { id:number; registrationNo:string; trackingToken:string; message:string };
type StatusResult = { admission:Record<string,unknown>; documents:Record<string,unknown>[] };

export default function PublicPpdbPage() {
  const [tab,setTab]=useState<"daftar"|"status">("daftar");
  const [form,setForm]=useState({name:"",applicant_email:"",nisn:"",birth_place:"",birth_date:"",gender:"Laki-laki",desired_level:"SMP",guardian_name:"",guardian_phone:"",previous_school:"",address:"",website:""});
  const [files,setFiles]=useState<Record<string,File>>({});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [created,setCreated]=useState<Result|null>(null);
  const [tracking,setTracking]=useState({registrationNo:"",token:""});
  const [status,setStatus]=useState<StatusResult|null>(null);
  const field=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));

  async function submit(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const missing=documentTypes.slice(0,4).find(type=>!files[type]);
      if(missing) throw new Error(`${missing} wajib diunggah.`);
      const response=await fetch("/api/ppdb",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(form)});
      const result=await response.json() as Result&{error?:string};
      if(!response.ok) throw new Error(result.error||"Pendaftaran gagal.");
      for(const [docType,file] of Object.entries(files)) {
        const body=new FormData(); body.set("admissionId",String(result.id)); body.set("trackingToken",result.trackingToken); body.set("docType",docType); body.set("file",file);
        const upload=await fetch("/api/ppdb/documents",{method:"POST",body});
        const uploadResult=await upload.json() as {error?:string};
        if(!upload.ok) throw new Error(uploadResult.error||`${docType} gagal diunggah.`);
      }
      setCreated(result); setTracking({registrationNo:result.registrationNo,token:result.trackingToken});
    } catch(e) { setError(e instanceof Error?e.message:"Pendaftaran gagal."); }
    finally { setSaving(false); }
  }

  async function checkStatus(event:React.FormEvent) {
    event.preventDefault(); setSaving(true); setError(""); setStatus(null);
    try {
      const response=await fetch(`/api/ppdb?registrationNo=${encodeURIComponent(tracking.registrationNo)}&token=${encodeURIComponent(tracking.token)}`,{cache:"no-store"});
      const result=await response.json() as StatusResult&{error?:string};
      if(!response.ok) throw new Error(result.error||"Status tidak ditemukan.");
      setStatus(result);
    } catch(e) { setError(e instanceof Error?e.message:"Status tidak dapat dimuat."); }
    finally { setSaving(false); }
  }

  return <main className="public-ppdb">
    <header className="ppdb-public-header"><a className="ppdb-public-brand" href="/ppdb"><BrandMark/><div><strong>SINURMAN</strong><small>PPDB Pondok Pesantren Nurul Iman</small></div></a><a className="secondary-button link-button" href="/wali">Masuk Portal Wali</a></header>
    <section className="ppdb-public-hero"><div><span>PPDB ONLINE 2026/2027</span><h1>Tumbuh dalam ilmu,<br/>adab, dan iman.</h1><p>Pendaftaran santri baru jenjang SMP dan SMK. Isi formulir, unggah berkas, lalu pantau verifikasi secara daring.</p><div className="ppdb-public-points"><span>✓ Pendaftaran daring</span><span>✓ Dokumen aman</span><span>✓ Status transparan</span></div></div><aside><strong>Alur Pendaftaran</strong>{["Lengkapi formulir","Unggah dokumen","Verifikasi panitia","Tes dan pengumuman"].map((step,index)=><div key={step}><i>{index+1}</i><span>{step}</span></div>)}</aside></section>
    <section className="ppdb-public-panel">
      <div className="ppdb-public-tabs"><button className={tab==="daftar"?"active":""} onClick={()=>{setTab("daftar");setError("");}}>Formulir Pendaftaran</button><button className={tab==="status"?"active":""} onClick={()=>{setTab("status");setError("");}}>Cek Status</button></div>
      {tab==="daftar"?(created?<article className="ppdb-success"><span>✓</span><h2>Pendaftaran berhasil dikirim</h2><p>Simpan informasi berikut. Kode pelacakan hanya ditampilkan setelah pendaftaran berhasil.</p><dl><dt>Nomor Pendaftaran</dt><dd>{created.registrationNo}</dd><dt>Kode Pelacakan</dt><dd>{created.trackingToken}</dd></dl><button className="primary-button" onClick={()=>{setTab("status");void navigator.clipboard?.writeText(`${created.registrationNo}\n${created.trackingToken}`);}}>Salin & Cek Status</button></article>:<form className="ppdb-public-form" onSubmit={submit}><header><div><span>DATA CALON SANTRI</span><h2>Formulir PPDB</h2></div><small>Kolom bertanda * wajib diisi</small></header><div className="form-grid">
        <label>Nama lengkap *<input required value={form.name} onChange={e=>field("name",e.target.value)}/></label><label>NISN *<input required inputMode="numeric" value={form.nisn} onChange={e=>field("nisn",e.target.value)}/></label>
        <label>Tempat lahir *<input required value={form.birth_place} onChange={e=>field("birth_place",e.target.value)}/></label><label>Tanggal lahir *<input required type="date" value={form.birth_date} onChange={e=>field("birth_date",e.target.value)}/></label>
        <label>Jenis kelamin *<select value={form.gender} onChange={e=>field("gender",e.target.value)}><option>Laki-laki</option><option>Perempuan</option></select></label><label>Jenjang tujuan *<select value={form.desired_level} onChange={e=>field("desired_level",e.target.value)}><option>SMP</option><option>SMK</option></select></label>
        <label>Asal sekolah *<input required value={form.previous_school} onChange={e=>field("previous_school",e.target.value)}/></label><label>Nama wali *<input required value={form.guardian_name} onChange={e=>field("guardian_name",e.target.value)}/></label>
        <label>Email wali *<input required type="email" value={form.applicant_email} onChange={e=>field("applicant_email",e.target.value)}/></label><label>WhatsApp wali *<input required type="tel" value={form.guardian_phone} onChange={e=>field("guardian_phone",e.target.value)}/></label>
        <label className="wide">Alamat lengkap *<textarea required value={form.address} onChange={e=>field("address",e.target.value)}/></label><label className="ppdb-honeypot">Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e=>field("website",e.target.value)}/></label>
      </div><div className="ppdb-upload-section"><h3>Dokumen Pendaftaran</h3><p>PDF, JPG, atau PNG. Maksimal 5 MB per berkas.</p><div>{documentTypes.map((type,index)=><label key={type}><span><strong>{type}</strong><small>{index<4?"Wajib":"Opsional"}</small></span><input required={index<4} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>e.target.files?.[0]&&setFiles(current=>({...current,[type]:e.target.files![0]}))}/><em>{files[type]?.name||"Pilih berkas"}</em></label>)}</div></div>{error&&<div className="form-error">{error}</div>}<button className="primary-button ppdb-submit" disabled={saving}>{saving?"Mengirim pendaftaran…":"Kirim Pendaftaran →"}</button></form>):<form className="ppdb-status-form" onSubmit={checkStatus}><span>PELACAKAN PPDB</span><h2>Cek status pendaftaran</h2><p>Masukkan nomor pendaftaran dan kode pelacakan yang diterima setelah mengirim formulir.</p><label>Nomor pendaftaran<input required value={tracking.registrationNo} onChange={e=>setTracking({...tracking,registrationNo:e.target.value.toUpperCase()})} placeholder="PPDB-2026-XXXXXXXX"/></label><label>Kode pelacakan<input required value={tracking.token} onChange={e=>setTracking({...tracking,token:e.target.value})} placeholder="Kode rahasia pendaftaran"/></label>{error&&<div className="form-error">{error}</div>}<button className="primary-button" disabled={saving}>{saving?"Memeriksa…":"Lihat Status"}</button>{status&&<article className="ppdb-status-result"><header><div><small>{String(status.admission.registration_no)}</small><h3>{String(status.admission.name)}</h3></div><b>{String(status.admission.status)}</b></header><p>{String(status.admission.desired_level)} · {String(status.admission.previous_school)}</p>{Boolean(status.admission.verification_note)&&<blockquote>{String(status.admission.verification_note)}</blockquote>}<div>{status.documents.map(document=><span key={String(document.id)}><strong>{String(document.doc_type)}</strong><em>{String(document.status)}</em></span>)}</div></article>}</form>}
      </section><footer className="ppdb-public-footer">© 2026 Pondok Pesantren Nurul Iman · PPDB Online SINURMAN</footer>
  </main>;
}
