import { cardStatus } from "../../../../lib/student-card";
import { database, ensureDatabaseSchema } from "../../_lib";

export async function GET(request: Request) {
  await ensureDatabaseSchema();
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length < 12) return Response.json({ error: "Token kartu tidak valid." }, { status: 404 });
  const student = await database().prepare("SELECT name,nis,nisn,education_level,class_name,entry_year,status,photo_url FROM students WHERE card_public_token=?").bind(token).first<Record<string,unknown>>();
  if (!student) return Response.json({ error: "Kartu tidak ditemukan atau sudah dicabut." }, { status: 404 });
  return Response.json({ valid: cardStatus(student.status) === "Aktif", student: { name: student.name, nis: student.nis, nisn: student.nisn, education_level: student.education_level, class_name: student.class_name, entry_year: student.entry_year, status: cardStatus(student.status), photo_url: student.photo_url } });
}
