"use client";

import { useEffect, useMemo, useState } from "react";

type Question = { id: number; prompt: string; options: string[]; correct_option: string; points: number; category: string; difficulty: string; active: number };
type Assignment = { id: number; admission_id: number; status: string; result_status: string; score: number; total_points: number; passing_score: number; published: number; submitted_at: string; name: string; registration_no: string };
type Candidate = { id: number; name: string; registration_no: string; status: string };

export default function SpmbTestAdminPage() {
  const queryAdmissionId = useMemo(() => Number(new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("admissionId") || 0), []);
  const [questions, setQuestions] = useState<Question[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]); const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [targetAdmission, setTargetAdmission] = useState(queryAdmissionId); const [selected, setSelected] = useState<number[]>([]);
  const [prompt, setPrompt] = useState(""); const [options, setOptions] = useState(""); const [correct, setCorrect] = useState(""); const [points, setPoints] = useState("1"); const [category, setCategory] = useState("Umum"); const [difficulty, setDifficulty] = useState("Sedang");
  const [testName, setTestName] = useState("Tes SPMB"); const [instructions, setInstructions] = useState(""); const [duration, setDuration] = useState("0"); const [passingScore, setPassingScore] = useState("75"); const [opensAt, setOpensAt] = useState(""); const [closesAt, setClosesAt] = useState(""); const [shuffleQuestions, setShuffleQuestions] = useState(false); const [shuffleOptions, setShuffleOptions] = useState(false);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch(`/api/admissions/test${queryAdmissionId ? `?admissionId=${queryAdmissionId}` : ""}`);
    const result = await response.json() as { questions?: Question[]; assignments?: Assignment[]; admissions?: Candidate[]; error?: string };
    if (!response.ok) { setMessage(result.error || "Akses ditolak."); return; }
    setQuestions(result.questions || []); setAssignments(result.assignments || []); setCandidates(result.admissions || []);
  }
  // Initial hydration for this client-only admin tool.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  async function createQuestion(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const response = await fetch("/api/admissions/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "question", prompt, options: options.split("\n").map(item => item.trim()).filter(Boolean), correct_option: correct, points: Number(points), category, difficulty }) });
    const result = await response.json() as { message?: string; error?: string }; setBusy(false); setMessage(result.message || result.error || "");
    if (response.ok) { setPrompt(""); setOptions(""); setCorrect(""); await load(); }
  }
  async function assign() {
    if (!targetAdmission || !selected.length) { setMessage("Pilih calon santri dan minimal satu soal."); return; }
    setBusy(true);
    const response = await fetch("/api/admissions/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "assign", admission_id: targetAdmission, question_ids: selected, test_name: testName, instructions, duration_minutes: Number(duration), passing_score: Number(passingScore), opens_at: opensAt ? new Date(opensAt).toISOString() : "", closes_at: closesAt ? new Date(closesAt).toISOString() : "", shuffle_questions: shuffleQuestions, shuffle_options: shuffleOptions }) });
    const result = await response.json() as { message?: string; error?: string }; setBusy(false); setMessage(result.message || result.error || ""); if (response.ok) await load();
  }
  async function publish(id: number) {
    setBusy(true); const response = await fetch("/api/admissions/test", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish", assignment_id: id }) }); const result = await response.json() as { message?: string; error?: string }; setBusy(false); setMessage(result.message || result.error || ""); if (response.ok) await load();
  }
  async function archive(id: number) {
    if (!window.confirm("Arsipkan soal ini? Soal tidak akan dipakai untuk penugasan baru.")) return;
    const response = await fetch("/api/admissions/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "archive-question", id }) }); const result = await response.json() as { message?: string; error?: string }; setMessage(result.message || result.error || ""); if (response.ok) await load();
  }

  return <main className="feature-app admissions-app"><section className="summary-banner admission-banner"><div><span>SPMB · BANK SOAL</span><strong>Soal Tes Calon Santri</strong><p>Buat bank soal, atur jadwal, tugaskan ke pendaftar, dan sahkan nilai.</p></div></section>
    <section className="card data-card"><header className="card-header"><div><h3>Tambah Soal</h3><p>Satu opsi per baris; soal yang telah dipakai tidak dapat diedit agar histori tetap utuh.</p></div></header><form className="form-grid" onSubmit={createQuestion}><label className="wide">Pertanyaan<textarea required value={prompt} onChange={event => setPrompt(event.target.value)} /></label><label>Opsi jawaban<textarea required value={options} onChange={event => setOptions(event.target.value)} placeholder={"Opsi A\nOpsi B\nOpsi C"} /></label><label>Jawaban benar<input required value={correct} onChange={event => setCorrect(event.target.value)} /></label><label>Poin<input type="number" min="1" max="100" value={points} onChange={event => setPoints(event.target.value)} /></label><label>Kategori<select value={category} onChange={event => setCategory(event.target.value)}><option>Umum</option><option>Akademik</option><option>Keagamaan</option><option>Pengetahuan Umum</option></select></label><label>Kesulitan<select value={difficulty} onChange={event => setDifficulty(event.target.value)}><option>Mudah</option><option>Sedang</option><option>Sulit</option></select></label><div className="modal-actions"><button className="primary-button" disabled={busy}>{busy ? "Menyimpan…" : "Tambah Soal"}</button></div></form></section>
    <section className="card data-card"><header className="card-header"><div><h3>Pengaturan Penugasan</h3><p>Semua waktu dan batas nilai tetap divalidasi ulang oleh server.</p></div><button className="primary-button" disabled={busy || !targetAdmission || !selected.length} onClick={() => void assign()}>Tugaskan Soal</button></header><div className="form-grid"><label>Calon santri<select value={targetAdmission} onChange={event => setTargetAdmission(Number(event.target.value))}><option value={0}>Pilih calon santri</option>{candidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.registration_no} · {candidate.name}</option>)}</select></label><label>Nama tes<input value={testName} onChange={event => setTestName(event.target.value)} /></label><label>Mulai<input type="datetime-local" value={opensAt} onChange={event => setOpensAt(event.target.value)} /></label><label>Selesai<input type="datetime-local" value={closesAt} onChange={event => setClosesAt(event.target.value)} /></label><label>Durasi (menit)<input type="number" min="0" max="600" value={duration} onChange={event => setDuration(event.target.value)} /></label><label>Nilai minimum<input type="number" min="0" max="100" value={passingScore} onChange={event => setPassingScore(event.target.value)} /></label><label className="wide">Instruksi<textarea value={instructions} onChange={event => setInstructions(event.target.value)} /></label><label><input type="checkbox" checked={shuffleQuestions} onChange={event => setShuffleQuestions(event.target.checked)} /> Acak urutan soal</label><label><input type="checkbox" checked={shuffleOptions} onChange={event => setShuffleOptions(event.target.checked)} /> Acak opsi jawaban</label></div></section>
    <section className="card data-card"><header className="card-header"><div><h3>Bank Soal ({questions.length})</h3><p>Pilih soal yang akan masuk ke tes.</p></div></header><div className="portal-list">{questions.map(question => <label key={question.id}><input type="checkbox" disabled={!question.active} checked={selected.includes(question.id)} onChange={event => setSelected(current => event.target.checked ? [...current, question.id] : current.filter(id => id !== question.id))} /><span>{question.prompt}<small>{question.category} · {question.difficulty} · {question.points} poin{!question.active ? " · Diarsipkan" : ""}</small></span>{question.active && <button type="button" className="text-button" onClick={() => void archive(question.id)}>Arsipkan</button>}</label>)}{!questions.length && <p>Belum ada soal.</p>}</div></section>
    <section className="card data-card"><header className="card-header"><div><h3>Hasil Penugasan</h3><p>Nilai baru terlihat oleh calon santri setelah disahkan.</p></div></header><div className="portal-list">{assignments.map(assignment => <div key={assignment.id}><span><strong>{assignment.name}</strong><small>{assignment.registration_no} · {assignment.status} · {assignment.result_status} · Nilai {assignment.score}/100</small></span>{!assignment.published && assignment.submitted_at && <button className="text-button" onClick={() => void publish(assignment.id)}>Sahkan nilai</button>}</div>)}{!assignments.length && <p>Belum ada penugasan.</p>}</div></section>{message && <p className="form-error">{message}</p>}
  </main>;
}
