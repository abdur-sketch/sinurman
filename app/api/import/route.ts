import { readSheet } from "read-excel-file/node";
import { database, ensureUser, normalizeGuardianPhone } from "../_lib";

function parseCsv(text:string) {
  const rows:string[][]=[];
  let row:string[]=[],value="",quoted=false;
  for(let index=0;index<text.length;index++) {
    const character=text[index];
    if(character==='"') {
      if(quoted&&text[index+1]==='"'){value+='"';index++;}
      else quoted=!quoted;
    } else if(character===","&&!quoted){row.push(value);value="";}
    else if((character==="\n"||character==="\r")&&!quoted){
      if(character==="\r"&&text[index+1]==="\n")index++;
      row.push(value);if(row.some(cell=>cell.trim()))rows.push(row);row=[];value="";
    } else value+=character;
  }
  row.push(value);if(row.some(cell=>cell.trim()))rows.push(row);
  return rows;
}

function recordsFromRows(rows:unknown[][]) {
  const headers=(rows[0]??[]).map(value=>String(value??"").trim().toLocaleLowerCase("id-ID"));
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])) as Record<string,unknown>);
}

export async function POST(request: Request) {
  try {
    const user=await ensureUser(request);
    if(user.role!=="Admin") return Response.json({error:"Impor hanya tersedia untuk Admin."},{status:403});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File)) return Response.json({error:"Berkas Excel/CSV wajib dipilih."},{status:400});
    if(file.size>3_000_000) return Response.json({error:"Ukuran berkas maksimal 3 MB."},{status:400});
    const bytes=Buffer.from(await file.arrayBuffer());
    const tabularRows:unknown[][]=file.name.toLocaleLowerCase("id-ID").endsWith(".csv")
      ? parseCsv(bytes.toString("utf8"))
      : await readSheet(bytes) as unknown[][];
    const rows=recordsFromRows(tabularRows);
    const valid=rows.filter(r=>r.nama&&r.nis&&r.kelas);
    if(!valid.length) return Response.json({error:"Kolom wajib: nama, nis, kelas. Kolom opsional: kamar, nama_wali, whatsapp, email_wali."},{status:400});
    const now=new Date().toISOString();
    const statements=valid.slice(0,500).map(r=>database().prepare("INSERT OR IGNORE INTO students (name, nis, class_name, room, guardian_name, guardian_phone, guardian_email, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(String(r.nama),String(r.nis),String(r.kelas),String(r.kamar||"-"),String(r.nama_wali||"-"),normalizeGuardianPhone(r.whatsapp),String(r.email_wali||"").toLocaleLowerCase("id-ID"),"Aktif",now));
    const results=[];
    for(let start=0;start<statements.length;start+=350) results.push(...await database().batch(statements.slice(start,start+350)));
    const imported=results.reduce((sum,r)=>sum+Number(r.meta.changes||0),0);
    await database().prepare("INSERT INTO audit_logs (user_email, action, resource, record_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(user.email,"Impor","students",null,`Mengimpor ${imported} santri`,now).run();
    return Response.json({ok:true,imported});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Impor gagal."},{status:500});
  }
}
