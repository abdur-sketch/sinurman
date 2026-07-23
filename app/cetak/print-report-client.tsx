"use client";

import { useEffect, useMemo, useState } from "react";

type ReportPayload = {
  title: string;
  description: string;
  columns: { key:string; label:string }[];
  rows: Record<string,unknown>[];
  generatedAt: string;
  period: { from:string; to:string; label:string };
  preparedBy: { name:string; role:string; roomScope?:string };
};

function display(value:unknown) {
  if (value===null||value===undefined||value==="") return "-";
  if (typeof value==="number") return new Intl.NumberFormat("id-ID").format(value);
  return String(value);
}

export default function PrintReportClient() {
  const [data,setData]=useState<ReportPayload|null>(null);
  const [error,setError]=useState("");
  const [printing,setPrinting]=useState(false);
  const params=useMemo(()=>typeof window==="undefined"?new URLSearchParams():new URLSearchParams(window.location.search),[]);

  useEffect(()=>{
    const type=params.get("type")||"students";
    const from=params.get("from")||"";
    const to=params.get("to")||"";
    const controller=new AbortController();
    void (async()=>{
      try {
        const response=await fetch(`/api/export?type=${encodeURIComponent(type)}&format=json&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,{cache:"no-store",signal:controller.signal});
        const result=await response.json() as ReportPayload&{error?:string};
        if(!response.ok) throw new Error(result.error||"Laporan tidak dapat dimuat.");
        setData(result);
        document.title=`${result.title} - SINURMAN`;
        if(params.get("auto")==="1") window.setTimeout(()=>{setPrinting(true);window.print();setPrinting(false);},450);
      } catch (caught) {
        if(!controller.signal.aborted) setError(caught instanceof Error?caught.message:"Laporan tidak dapat dimuat.");
      }
    })();
    return()=>controller.abort();
  },[params]);

  if(error) return <main className="print-error"><span>!</span><h1>Laporan gagal dimuat</h1><p>{error}</p><button type="button" onClick={()=>window.close()}>Tutup halaman</button></main>;
  if(!data) return <main className="print-loading"><span>ن</span><strong>Menyiapkan laporan SINURMAN…</strong></main>;

  return <main className="print-report-page">
    <div className="print-controls no-print"><button type="button" onClick={()=>window.close()}>← Kembali</button><div><span>{data.rows.length} data siap dicetak</span><button type="button" disabled={printing} onClick={()=>window.print()}>{printing?"Membuka…":"Cetak Sekarang"}</button></div></div>
    <article className="print-sheet">
      <header className="print-letterhead"><span>ن</span><div><strong>PONDOK PESANTREN NURUL IMAN</strong><small>Sistem Informasi Nurul Iman - SINURMAN</small><p>Administrasi Pesantren Terpadu · Tahun Ajaran 2026/2027</p></div></header>
      <section className="print-report-title"><span>LAPORAN RESMI SINURMAN</span><h1>{data.title}</h1><p>{data.description}</p></section>
      <section className="print-meta"><div><small>Periode</small><strong>{data.period.label}</strong></div><div><small>Jumlah data</small><strong>{data.rows.length} baris</strong></div><div><small>Dicetak oleh</small><strong>{data.preparedBy.name}</strong></div><div><small>Waktu cetak</small><strong>{data.generatedAt}</strong></div></section>
      <div className="print-table-wrap"><table><thead><tr><th>No.</th>{data.columns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{data.rows.map((row,index)=><tr key={index}><td>{index+1}</td>{data.columns.map(column=><td key={column.key}>{display(row[column.key])}</td>)}</tr>)}{!data.rows.length&&<tr><td colSpan={data.columns.length+1}>Tidak ada data pada periode yang dipilih.</td></tr>}</tbody></table></div>
      <section className="print-signatures"><div><span>Mengetahui,</span><strong>Pimpinan Pesantren</strong><i /><b>____________________________</b><small>Nama jelas dan tanda tangan</small></div><div><span>Dicetak di SINURMAN, {data.generatedAt.split(",")[0]}</span><strong>{data.preparedBy.role}</strong><i /><b>{data.preparedBy.name}</b><small>{data.preparedBy.roomScope?`Penugasan kamar: ${data.preparedBy.roomScope}`:"Petugas yang berwenang"}</small></div></section>
      <footer className="print-footer"><span>Dokumen ini dihasilkan otomatis oleh SINURMAN.</span><span>Pondok Pesantren Nurul Iman</span></footer>
    </article>
  </main>;
}
