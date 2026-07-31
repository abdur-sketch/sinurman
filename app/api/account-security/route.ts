import { database, ensureUser } from "../_lib";

export const runtime="nodejs";

export async function GET(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.authProvider!=="firebase") return Response.json({provider:user.authProvider||"chatgpt",sessions:[],mfa:{available:false,enrolled:false,required:false}});
    const [{firebaseAdmin},{getFirebaseSession,listFirebaseSessions}]=await Promise.all([import("../../../lib/firebase/admin"),import("../../../lib/firebase/session")]);
    const session=await getFirebaseSession(request);
    if(!session) return Response.json({error:"Sesi Firebase tidak ditemukan."},{status:401});
    const account=await firebaseAdmin().auth.getUser(session.uid);
    return Response.json({provider:"firebase",sessions:await listFirebaseSessions(request,session.uid),mfa:{available:true,enrolled:Boolean(account.multiFactor?.enrolledFactors?.length),required:process.env.REQUIRE_ADMIN_MFA==="true"&&user.role==="Admin"}});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Keamanan akun gagal dimuat."},{status:500});
  }
}

export async function DELETE(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.authProvider!=="firebase") return Response.json({error:"Pengelolaan sesi hanya tersedia untuk akun Firebase."},{status:400});
    const {getFirebaseSession,removeFirebaseSessionById}=await import("../../../lib/firebase/session");
    const session=await getFirebaseSession(request);
    if(!session) return Response.json({error:"Sesi Firebase tidak ditemukan."},{status:401});
    const body=await request.json() as {sessionId?:string};
    if(!body.sessionId) return Response.json({error:"Sesi wajib dipilih."},{status:400});
    await removeFirebaseSessionById(session.uid,body.sessionId);
    await database().prepare("INSERT INTO audit_logs (user_email,action,resource,record_id,detail,created_at) VALUES (?,?,?,NULL,?,?)")
      .bind(user.email,"Cabut Sesi","security",`Mencabut sesi perangkat ${body.sessionId.slice(0,10)}`,new Date().toISOString()).run();
    return Response.json({ok:true});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Sesi gagal dicabut."},{status:400});
  }
}
