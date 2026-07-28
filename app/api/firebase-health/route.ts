export const runtime="nodejs";

export async function GET() {
  if(process.env.FIREBASE_RUNTIME!=="true") {
    return Response.json({ready:false,runtime:"sites",services:{},missing:[]},{status:404});
  }
  const {firebaseAdmin}=await import("../../../lib/firebase/admin");
  const required=[
    "FIREBASE_PROJECT_ID",
    "FIREBASE_STORAGE_BUCKET",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ];
  const missing=required.filter(key=>!process.env[key]);
  const checks=missing.length
    ? []
    : await Promise.allSettled([
      firebaseAdmin().auth.listUsers(1),
      firebaseAdmin().firestore.collection("_health").limit(1).get(),
      firebaseAdmin().storage.bucket().getMetadata(),
    ]);
  const services={
    authentication:checks[0]?.status==="fulfilled",
    firestore:checks[1]?.status==="fulfilled",
    storage:checks[2]?.status==="fulfilled",
  };
  const ready=missing.length===0&&Object.values(services).every(Boolean);
  return Response.json({
    ready,
    runtime:"firebase-app-hosting",
    services,
    missing,
  },{status:ready?200:503});
}
