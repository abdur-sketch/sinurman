import { database, ensureUser } from "../_lib";

export async function GET(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.role!=="Admin")return Response.json({error:"Khusus Admin."},{status:403});
    const url=new URL(request.url);
    const limit=Math.min(100,Math.max(10,Number(url.searchParams.get("limit")||50)));
    const before=Math.max(0,Number(url.searchParams.get("before")||0));
    const statement=before
      ? database().prepare(`SELECT * FROM audit_logs WHERE id<? ORDER BY id DESC LIMIT ${limit}`).bind(before)
      : database().prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ${limit}`);
    const result=await statement.all<Record<string,unknown>>();
    const nextCursor=result.results.length===limit?Number(result.results.at(-1)?.id||0):0;
    return Response.json({records:result.results,nextCursor});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Audit gagal dimuat."},{status:500});
  }
}
