import { database, ensureUser } from "../_lib";

export async function GET(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") return Response.json({error:"Khusus Admin."},{status:403});
  const profile=await database().prepare("SELECT * FROM institution_profile WHERE id=1").first<Record<string,unknown>>();
  return Response.json({profile:profile||null,complete:Boolean(profile&&["institution_name","address","leader_name","system_manager"].every(key=>String(profile[key]||"").trim()))});
}

export async function PUT(request:Request) {
  const user=await ensureUser(request);
  if(user.role!=="Admin") return Response.json({error:"Khusus Admin."},{status:403});
  const body=await request.json() as Record<string,unknown>;
  const fields=["institution_name","foundation_name","address","village","district","city","province","postal_code","phone","whatsapp","email","website","logo_url","leader_name","system_manager"];
  const values=fields.map(field=>String(body[field]??"").trim());
  const db=database();
  const now=new Date().toISOString();
  const updated=await db.prepare("UPDATE institution_profile SET institution_name=?,foundation_name=?,address=?,village=?,district=?,city=?,province=?,postal_code=?,phone=?,whatsapp=?,email=?,website=?,logo_url=?,leader_name=?,system_manager=?,updated_at=? WHERE id=1").bind(...values,now).run();
  if(!Number(updated.meta.changes??0)) await db.prepare("INSERT INTO institution_profile (id,institution_name,foundation_name,address,village,district,city,province,postal_code,phone,whatsapp,email,website,logo_url,leader_name,system_manager,updated_at) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(...values,now).run();
  await db.prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,?,?,?)").bind(user.email,"INSTITUTION_PROFILE_UPDATED","institution_profile",1,"Profil pesantren diperbarui",new Date().toISOString()).run();
  return Response.json({ok:true,message:"Profil pesantren berhasil disimpan."});
}
