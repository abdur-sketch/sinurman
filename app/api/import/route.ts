import * as XLSX from "xlsx";
import { database, ensureUser } from "../_lib";

export async function POST(request: Request) {
  try {
    const user=await ensureUser(request);
    if(user.role!=="Admin") return Response.json({error:"Impor hanya tersedia untuk Admin."},{status:403});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File)) return Response.json({error:"Berkas Excel/CSV wajib dipilih."},{status:400});
    if(file.size>3_000_000) return Response.json({error:"Ukuran berkas maksimal 3 MB."},{status:400});
    const workbook=XLSX.read(await file.arrayBuffer(),{type:"array"});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet);
    const valid=rows.filter(r=>r.nama&&r.nis&&r.kelas);
    if(!valid.length) return Response.json({error:"Kolom wajib: nama, nis, kelas. Kolom opsional: kamar, nama_wali, whatsapp, email_wali."},{status:400});
    const now=new Date().toISOString();
    const statements=valid.slice(0,500).map(r=>database().prepare("INSERT OR IGNORE INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(String(r.nama),String(r.nis),String(r.kelas),String(r.kamar||"-"),String(r.nama_wali||"-"),String(r.whatsapp||"-"),String(r.email_wali||"").toLocaleLowerCase("id-ID"),"Aktif",now));
    const results=await database().batch(statements);
    const imported=results.reduce((sum,r)=>sum+Number(r.meta.changes||0),0);
    await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Impor","students",null,`Mengimpor ${imported} santri`,now).run();
    return Response.json({ok:true,imported});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Impor gagal."},{status:500});
  }
}
