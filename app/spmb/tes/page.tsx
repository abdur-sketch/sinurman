"use client";

import { useEffect, useState } from "react";
import BrandMark from "../../brand-mark";

type Question = { id: number; prompt: string; options: string[]; points: number };
type TestData = { available: boolean; message?: string; assignment?: { test_name?: string; instructions?: string; duration_minutes?: number; status: string; result_status?: string; opens_at: string; closes_at: string; submitted_at: string; score: number | null; total_points: number | null }; questions?: Question[]; answers?: { question_id: number; answer: string }[] };

export default function SpmbTestPage() {
  const [data, setData] = useState<TestData | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  async function load() {
    setBusy(true);
    const response = await fetch("/api/spmb/track/test", { cache: "no-store" });
    const result = await response.json() as TestData & { error?: string };
    setBusy(false);
    if (!response.ok) { setMessage(result.error || "Sesi portal tidak tersedia."); return; }
    setData(result); setAnswers(Object.fromEntries((result.answers || []).map(answer => [answer.question_id, answer.answer])));
  }
  // The initial fetch intentionally hydrates the client-only exam session.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, []);
  // The browser timer is only a usability aid; the server validates every deadline.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!data?.assignment?.closes_at || data.assignment.submitted_at) return; const tick = () => setSecondsLeft(Math.max(0, Math.floor((Date.parse(data.assignment!.closes_at) - Date.now()) / 1000))); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [data?.assignment?.closes_at, data?.assignment?.submitted_at]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!data?.questions?.length || !window.confirm("Kirim jawaban sekarang? Jawaban tidak dapat diubah setelah dikirim.")) return;
    setBusy(true); setMessage("");
    const response = await fetch("/api/spmb/track/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ answers: data.questions.map(question => ({ question_id: question.id, answer: answers[question.id] || "" })) }) });
    const result = await response.json() as { error?: string; message?: string };
    setBusy(false); setMessage(result.message || result.error || "Jawaban belum dapat dikirim.");
    if (response.ok) await load();
  }

  return <main className="public-ppdb"><header className="ppdb-public-header"><a className="ppdb-public-brand" href="/spmb/lacak"><BrandMark /><div><strong>SINURMAN</strong><small>SPMB Pondok Pesantren Nurul Iman</small></div></a><a className="secondary-button link-button" href="/spmb/lacak">← Kembali ke status</a></header><section className="ppdb-public-panel spmb-track-panel"><span>TES SELEKSI SPMB</span><h1>{data?.assignment?.test_name || "Soal Tes Calon Santri"}</h1>{busy && !data ? <p>Memuat soal…</p> : message && !data ? <div className="form-error">{message}</div> : !data?.assignment ? <p>{data?.message || "Belum ada soal tes yang ditugaskan."}</p> : <><p>Status: <strong>{data.assignment.status}</strong>{secondsLeft !== null && !data.assignment.submitted_at && <strong> · Sisa waktu: {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</strong>}</p>{data.assignment.instructions && <p>{data.assignment.instructions}</p>}{data.assignment.score !== null && <p>Nilai: <strong>{data.assignment.score} / 100</strong> · {data.assignment.result_status}</p>}{data.questions?.length && !data.assignment.submitted_at ? <form className="ppdb-status-form" onSubmit={submit}>{data.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt} <small>({question.points} poin)</small></legend>{question.options.map(option => <label key={option}><input type="radio" name={`question-${question.id}`} checked={answers[question.id] === option} onChange={() => setAnswers(current => ({ ...current, [question.id]: option }))} /> {option}</label>)}</fieldset>)}{message && <div className="form-error">{message}</div>}<button className="primary-button" disabled={busy}>{busy ? "Mengirim…" : "Kirim Jawaban"}</button></form> : <p>{data.assignment.submitted_at ? "Jawaban sudah diterima. Hasil menunggu pengesahan admin." : "Tes belum dibuka atau sudah ditutup."}</p>}</>}</section></main>;
}
