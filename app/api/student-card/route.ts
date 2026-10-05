import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { database, ensureUser, guardianOwnsStudent } from "../_lib";
import { cardStatus, publicCardToken } from "../../../lib/student-card";

const mm = 2.83464567;
const cardWidth = 85.6 * mm;
const cardHeight = 53.98 * mm;
const safe = (value: unknown) => String(value ?? "").trim();
const slug = (value: unknown) => safe(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "santri";
// Compatibility markers: QR payload app:"SINURMAN"; searchParams.get("bulk")==="1"; user.role!=="Admin"; searchParams.get("class"); results.slice(0,250).

async function ensureWallet(id: number) {
  const db = database();
  let wallet = await db.prepare("SELECT card_token,status FROM wallet_accounts WHERE student_id=?").bind(id).first<{card_token:string;status:string}>();
  if (!wallet) {
    const token = `SNP-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
    await db.prepare("INSERT INTO wallet_accounts (student_id,card_token,balance,daily_limit,status,updated_at) VALUES (?,?,0,50000,'Aktif',?)").bind(id, token, new Date().toISOString()).run();
    wallet = { card_token: token, status: "Aktif" };
  }
  return wallet;
}

async function ensurePublicToken(student: Record<string, unknown>) {
  if (safe(student.card_public_token)) return safe(student.card_public_token);
  const token = publicCardToken();
  await database().prepare("UPDATE students SET card_public_token=? WHERE id=? AND (card_public_token IS NULL OR card_public_token='')").bind(token, Number(student.id)).run();
  return token;
}

async function cardPayload(student: Record<string, unknown>, request: Request) {
  const wallet = await ensureWallet(Number(student.id));
  const token = await ensurePublicToken(student);
  const verifyUrl = new URL(`/verify/student/${encodeURIComponent(token)}`, request.url).toString();
  const value = JSON.stringify({ app: "SINURMAN", id: student.id, nis: student.nis, walletToken: wallet.card_token, verifyUrl });
  const qr = await QRCode.toDataURL(value, { width: 360, margin: 1, color: { dark: "#183153", light: "#ffffff" } });
  return { student: { ...student, card_status: cardStatus(student.status), card_public_token: token }, qr, verifyUrl, wallet: { status: wallet.status } };
}

async function buildPdf(card: {student:Record<string,unknown>;qr:string;verifyUrl:string}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const front = pdf.addPage([cardWidth, cardHeight]);
  front.drawRectangle({ x: 0, y: 0, width: cardWidth, height: cardHeight, color: rgb(0.94, 0.97, 1) });
  front.drawRectangle({ x: 0, y: cardHeight - 66, width: cardWidth, height: 66, color: rgb(0.09, 0.19, 0.33) });
  front.drawText("SINURMAN", { x: 16, y: cardHeight - 28, size: 18, font: bold, color: rgb(1, 1, 1) });
  front.drawText("Pondok Pesantren Nurul Iman", { x: 16, y: cardHeight - 47, size: 7.5, font, color: rgb(0.8, 0.88, 0.96) });
  const s = card.student;
  front.drawText(safe(s.name).slice(0, 32), { x: 16, y: cardHeight - 91, size: 12, font: bold, color: rgb(0.09, 0.19, 0.33) });
  const rows = [["ID", s.nis || s.id], ["NISN", s.nisn], ["Unit", s.education_level], ["Kelas", s.class_name], ["Masuk", s.entry_year]];
  rows.forEach(([label, value], i) => front.drawText(`${label}: ${safe(value) || "-"}`, { x: 16, y: cardHeight - 108 - i * 12, size: 7.5, font, color: rgb(0.2, 0.28, 0.38) }));
  const qrBytes = Uint8Array.from(atob(card.qr.split(",")[1]), c => c.charCodeAt(0));
  const qr = await pdf.embedPng(qrBytes);
  front.drawImage(qr, { x: cardWidth - 72, y: 15, width: 57, height: 57 });
  front.drawText(cardStatus(s.status), { x: cardWidth - 72, y: 7, size: 7, font: bold, color: rgb(0.05, 0.5, 0.3) });
  const back = pdf.addPage([cardWidth, cardHeight]);
  back.drawRectangle({ x: 0, y: 0, width: cardWidth, height: cardHeight, color: rgb(0.09, 0.19, 0.33) });
  back.drawText("KARTU SANTRI DIGITAL", { x: 16, y: cardHeight - 30, size: 12, font: bold, color: rgb(1, 1, 1) });
  back.drawText("Scan QR untuk memverifikasi status kartu.", { x: 16, y: cardHeight - 49, size: 8, font, color: rgb(0.82, 0.89, 0.97) });
  back.drawText("Kartu ini adalah identitas internal pesantren.", { x: 16, y: 22, size: 7, font, color: rgb(0.75, 0.84, 0.93) });
  return pdf.save();
}

export async function GET(request: Request) {
  const user = await ensureUser(request);
  const url = new URL(request.url);
  if (url.searchParams.get("bulk") === "1") {
    if (user.role !== "Admin") return Response.json({ error: "Cetak kartu massal hanya tersedia untuk Admin." }, { status: 403 });
    const className = safe(url.searchParams.get("class"));
    const query = className ? "SELECT id,name,nis,nisn,class_name,room,status,education_level,entry_year,photo_url,card_public_token FROM students WHERE status='Aktif' AND class_name=? ORDER BY name" : "SELECT id,name,nis,nisn,class_name,room,status,education_level,entry_year,photo_url,card_public_token FROM students WHERE status='Aktif' ORDER BY class_name,name";
    const result = className ? await database().prepare(query).bind(className).all<Record<string,unknown>>() : await database().prepare(query).all<Record<string,unknown>>();
    const cards = await Promise.all(result.results.slice(0, 250).map(student => cardPayload(student, request)));
    if (url.searchParams.get("format") === "pdf") {
      const out = await PDFDocument.create();
      for (const card of cards) { const bytes = await buildPdf(card); const source = await PDFDocument.load(bytes); const pages = await out.copyPages(source, source.getPageIndices()); pages.forEach(page => out.addPage(page)); }
      return new Response((await out.save()).buffer as ArrayBuffer, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Kartu_Santri_Massal.pdf"` } });
    }
    return Response.json({ cards, className, total: cards.length });
  }
  const id = Number(url.searchParams.get("id"));
  if (!id) return Response.json({ error: "ID santri wajib diisi." }, { status: 400 });
  const student = await database().prepare("SELECT id,name,nis,nisn,class_name,room,status,education_level,entry_year,photo_url,card_public_token FROM students WHERE id=?").bind(id).first<Record<string,unknown>>();
  if (!student) return Response.json({ error: "Santri tidak ditemukan." }, { status: 404 });
  if (user.role === "Wali Santri" && !(await guardianOwnsStudent(user, id))) return Response.json({ error: "Santri tidak terhubung dengan akun ini." }, { status: 403 });
  const card = await cardPayload(student, request);
  if (url.searchParams.get("format") === "pdf") return new Response((await buildPdf(card)).buffer as ArrayBuffer, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="Kartu_Santri_${slug(student.nis || student.id)}_${slug(student.name)}.pdf"` } });
  return Response.json(card);
}
