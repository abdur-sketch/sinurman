export function reportServerError(context:string,error:unknown,request?:Request,metadata:Record<string,unknown>={}) {
  const requestId=request?.headers.get("x-request-id")||crypto.randomUUID();
  const payload={
    severity:"ERROR",
    service:"SINURMAN",
    context,
    requestId,
    method:request?.method,
    path:request?new URL(request.url).pathname:undefined,
    message:error instanceof Error?error.message:String(error),
    stack:process.env.NODE_ENV==="development"&&error instanceof Error?error.stack:undefined,
    ...metadata,
    occurredAt:new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
  return requestId;
}
