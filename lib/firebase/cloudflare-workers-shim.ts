import { firebaseAdmin } from "./admin";
import { firestoreD1Database } from "./firestore-d1";

const firebaseFiles = {
  async put(
    key:string,
    value:ArrayBuffer|ArrayBufferView|string,
    options?:{
      httpMetadata?:{contentType?:string};
      customMetadata?:Record<string,string>;
    },
  ) {
    const file=firebaseAdmin().storage.bucket().file(key);
    const bytes=typeof value==="string"
      ? Buffer.from(value)
      : value instanceof ArrayBuffer
        ? Buffer.from(value)
        : Buffer.from(value.buffer,value.byteOffset,value.byteLength);
    await file.save(bytes,{
      resumable:false,
      metadata:{
        contentType:options?.httpMetadata?.contentType||"application/octet-stream",
        metadata:options?.customMetadata,
        cacheControl:"private, no-store",
      },
    });
    return {key};
  },
  async get(key:string) {
    const file=firebaseAdmin().storage.bucket().file(key);
    const [exists]=await file.exists();
    if(!exists) return null;
    const [[bytes],[metadata]]=await Promise.all([file.download(),file.getMetadata()]);
    return {
      body:new Blob([new Uint8Array(bytes)]).stream(),
      httpMetadata:{contentType:metadata.contentType},
      customMetadata:metadata.metadata,
    };
  },
  async delete(key:string) {
    await firebaseAdmin().storage.bucket().file(key).delete({ignoreNotFound:true});
  },
};

export const env=new Proxy<Record<string,unknown>>({},{
  get(_target,property) {
    const key=String(property);
    if(key==="DB") return firestoreD1Database();
    if(key==="FILES") return firebaseFiles;
    return process.env[key];
  },
});
