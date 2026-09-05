import { database, ensureUser } from "../_lib";

export async function GET(request:Request) {
  try { await ensureUser(request); const url=new URL(request.url); const from=url.searchParams.get("from")||"0000-00-00"; const to=url.searchParams.get("to")||"9999-12-31"; const result=await database().prepare("SELECT * FROM academic_events WHERE start_date<=? AND end_date>=? ORDER BY start_date,start_time,id").bind(to,from).all<Record<string,unknown>>(); return Response.json({events:result.results}); }
  catch(error){return Response.json({error:error instanceof Error?error.message:"Agenda gagal dimuat."},{status:401});}
}

export async function POST(request:Request) {
  try { const user=await ensureUser(request); if(user.role!=="Admin")return Response.json({error:"Hanya Admin yang dapat mengelola kalender pendidikan."},{status:403}); const body=await request.json() as Record<string,unknown>; const title=String(body.title||"").trim(); const start=String(body.startDate||"").trim(); const end=String(body.endDate||start).trim(); if(!title||!/\d{4}-\d{2}-\d{2}/.test(start)||!/\d{4}-\d{2}-\d{2}/.test(end))return Response.json({error:"Judul dan tanggal agenda wajib diisi."},{status:400}); if(end<start)return Response.json({error:"Tanggal selesai tidak boleh sebelum tanggal mulai."},{status:400}); const now=new Date().toISOString(); const result=await database().prepare("INSERT INTO academic_events (title,category,start_date,end_date,start_time,location,description,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(title,String(body.category||"Kegiatan"),start,end,String(body.startTime||""),String(body.location||""),String(body.description||""),String(body.status||"Terjadwal"),user.email,now,now).run(); await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,"Tambah","academic_events",result.meta.last_row_id,`${title} · ${start}`,now).run(); return Response.json({ok:true,id:result.meta.last_row_id},{status:201}); }
  catch(error){return Response.json({error:error instanceof Error?error.message:"Agenda gagal disimpan."},{status:400});}
}

export async function DELETE(request:Request) {
  try { const user=await ensureUser(request); if(user.role!=="Admin")return Response.json({error:"Hanya Admin."},{status:403}); const id=Number(new URL(request.url).searchParams.get("id")); if(!id)return Response.json({error:"ID agenda tidak valid."},{status:400}); await database().prepare("DELETE FROM academic_events WHERE id=?").bind(id).run(); await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,"Hapus","academic_events",id,"Menghapus agenda kalender",new Date().toISOString()).run(); return Response.json({ok:true}); }
  catch(error){return Response.json({error:error instanceof Error?error.message:"Agenda gagal dihapus."},{status:400});}
}
