"use client";

/* QR kartu berasal dari data URL server dan tidak memerlukan optimisasi gambar. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "../brand-mark";

type Card={student:Record<string,string|number>;qr:string;wallet:{status:string}};

export default function BulkStudentCards() {
  const [cards,setCards]=useState<Card[]>([]);
  const [classes,setClasses]=useState<string[]>([]);
  const [selectedClass,setSelectedClass]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{void (async()=>{
    try {
      const response=await fetch("/api/bootstrap",{cache:"no-store"});
      const result=await response.json() as {students?:Array<Record<string,string|number>>;user?:{role?:string};error?:string};
      if(!response.ok) throw new Error(result.error||"Data santri gagal dimuat.");
      if(result.user?.role!=="Admin") throw new Error("Cetak kartu massal hanya tersedia untuk Admin.");
      setClasses([...new Set((result.students||[]).filter(row=>row.status==="Aktif").map(row=>String(row.class_name)))].sort());
    } catch(caught){setError(caught instanceof Error?caught.message:"Data santri gagal dimuat.");}
    finally{setLoading(false);}
  })();},[]);
  async function generate(){setLoading(true);setError("");try{const query=selectedClass?`&class=${encodeURIComponent(selectedClass)}`:"";const response=await fetch(`/api/student-card?bulk=1${query}`,{cache:"no-store"});const result=await response.json() as {cards?:Card[];error?:string};if(!response.ok)throw new Error(result.error||"Kartu gagal dibuat.");setCards(result.cards||[]);}catch(caught){setError(caught instanceof Error?caught.message:"Kartu gagal dibuat.");}finally{setLoading(false);}}
  return <main className="bulk-card-page"><header className="bulk-card-toolbar no-print"><div><BrandMark/><div><strong>Cetak Kartu Santri SINURMAN</strong><small>Kartu barcode/QR untuk presensi dan belanja kantin</small></div></div><label>Kelas<select value={selectedClass} onChange={event=>setSelectedClass(event.target.value)}><option value="">Semua kelas</option>{classes.map(item=><option key={item}>{item}</option>)}</select></label><button onClick={()=>void generate()} disabled={loading}>{loading?"Menyiapkan…":"Tampilkan Kartu"}</button><button onClick={()=>window.print()} disabled={!cards.length}>Cetak</button><Link href="/">Kembali</Link></header>{error&&<div className="bulk-card-error">{error}</div>}<section className="bulk-card-grid">{cards.map(card=><article className="student-id-card bulk" key={String(card.student.id)}><header><BrandMark className="brand-mark"/><div><strong>SINURMAN</strong><small>Pondok Pesantren Nurul Iman</small></div></header><div className="student-card-body"><div><span className="student-photo">{String(card.student.name).split(" ").map(value=>value[0]).slice(0,2).join("")}</span><h3>{card.student.name}</h3><p>{card.student.nis}</p><dl><dt>Kelas</dt><dd>{card.student.class_name}</dd><dt>Kamar</dt><dd>{card.student.room}</dd><dt>Kartu</dt><dd>{card.wallet.status}</dd></dl></div><img src={card.qr} alt={`QR ${card.student.name}`}/></div><footer>Kartu Santri Digital · Tahun Ajaran 2026/2027</footer></article>)}</section>{!cards.length&&!loading&&!error&&<div className="bulk-card-empty">Pilih kelas lalu tampilkan kartu untuk mencetak secara massal.</div>}</main>;
}
