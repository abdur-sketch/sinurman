import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { database, ensureUser } from "../_lib";

const exports = {
  students: {
    title: "Data Santri SINURMAN",
    query: "SELECT nis, name, class_name, room, guardian_name, status FROM students ORDER BY name",
  },
  tahfidz: {
    title: "Rekap Tahfidz SINURMAN",
    query: "SELECT s.name AS santri, t.surah, t.verses, t.amount, t.grade, t.recorded_at FROM tahfidz_records t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC",
  },
  finance: {
    title: "Laporan Keuangan SINURMAN",
    query: "SELECT s.name AS santri, t.type, t.category, t.amount, t.status, t.recorded_at FROM transactions t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC",
  },
  health: {
    title: "Rekap Kesehatan SINURMAN",
    query: "SELECT s.name AS santri, h.complaint, h.diagnosis, h.treatment, h.status, h.recorded_at FROM health_records h JOIN students s ON s.id=h.student_id ORDER BY h.id DESC",
  },
} as const;

function csvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    await ensureUser(request);
    const url = new URL(request.url);
    const type = (url.searchParams.get("type") ?? "students") as keyof typeof exports;
    const format = url.searchParams.get("format") ?? "csv";
    if (!(type in exports)) return Response.json({ error: "Jenis laporan tidak valid." }, { status: 400 });
    const config = exports[type];
    const result = await database().prepare(config.query).all<Record<string, unknown>>();
    const rows = result.results;
    const columns = rows.length ? Object.keys(rows[0]) : [];
    if (format === "pdf") {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage([842, 595]);
      let y = 555;
      page.drawText(config.title, { x: 35, y, size: 17, font: bold, color: rgb(.07, .18, .31) });
      y -= 24;
      page.drawText(`Dibuat ${new Date().toLocaleDateString("id-ID")} · ${rows.length} data`, { x: 35, y, size: 8, font, color: rgb(.42,.48,.56) });
      y -= 22;
      for (const row of rows) {
        const line = columns.map((c) => `${c}: ${String(row[c] ?? "")}`).join("  |  ").slice(0, 150);
        if (y < 35) { page = pdf.addPage([842, 595]); y = 555; }
        page.drawText(line, { x: 35, y, size: 7.5, font, color: rgb(.15,.2,.27) });
        y -= 16;
      }
      const bytes = await pdf.save();
      return new Response(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, {
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="sinurman-${type}.pdf"`,
        },
      });
    }
    const csv = [columns.map(csvValue).join(","), ...rows.map((row: Record<string, unknown>) => columns.map(c => csvValue(row[c])).join(","))].join("\n");
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="sinurman-${type}.csv"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Ekspor gagal." }, { status: 500 });
  }
}
