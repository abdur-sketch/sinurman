import { env } from "cloudflare:workers";
import { database } from "./_lib";

export async function sendWhatsappNotification(input: {
  studentId?: number | null;
  recipient: string;
  message: string;
  channel?: string;
  sensitive?: boolean;
}) {
  const phone=input.recipient.replace(/\D/g,"").replace(/^0/,"62");
  const whatsappUrl=`https://wa.me/${phone}?text=${encodeURIComponent(input.message)}`;
  let status="Disiapkan";
  let automatic=false;
  if(env.WHATSAPP_TOKEN&&env.WHATSAPP_PHONE_NUMBER_ID) {
    const response=await fetch(`https://graph.facebook.com/v22.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{
      method:"POST",
      headers:{"authorization":`Bearer ${env.WHATSAPP_TOKEN}`,"content-type":"application/json"},
      body:JSON.stringify({messaging_product:"whatsapp",to:phone,type:"text",text:{body:input.message}}),
    });
    automatic=response.ok;
    status=response.ok?"Terkirim":"Gagal";
  }
  await database().prepare("INSERT INTO notification_logs (student_id, channel, recipient, message, status, sent_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(input.studentId??null,input.channel??"WhatsApp",input.recipient,input.sensitive?"Pesan keamanan rahasia telah dikirim.":input.message,status,new Date().toISOString()).run();
  return {whatsappUrl,automatic,status};
}

export async function notifyGuardian(studentId:number,message:string) {
  const student=await database().prepare("SELECT guardian_phone FROM students WHERE id=?").bind(studentId).first<{guardian_phone:string}>();
  if(!student?.guardian_phone) return null;
  return sendWhatsappNotification({studentId,recipient:student.guardian_phone,message});
}

export async function notifyRecordChange(resource:string,row:Record<string,unknown>) {
  const studentId=Number(row.student_id);
  if(!studentId) return;
  const student=await database().prepare("SELECT name FROM students WHERE id=?").bind(studentId).first<{name:string}>();
  if(!student) return;
  let message="";
  if(resource==="attendance"&&row.status!=="Hadir") message=`SINURMAN: ${student.name} tercatat ${row.status} pada ${row.record_date}. ${row.note||""}`;
  if(resource==="tahfidz") {
    const surahFrom=String(row.surah_from||row.surah||"");
    const surahTo=String(row.surah_to||row.surah||surahFrom);
    const verseFrom=String(row.verse_from||String(row.verses||"").match(/\d+/)?.[0]||"");
    const verseTo=String(row.verse_to||String(row.verses||"").match(/\d+/g)?.[1]||verseFrom);
    const range=surahFrom.toLocaleLowerCase("id-ID")===surahTo.toLocaleLowerCase("id-ID")?`${surahFrom} ayat ${verseFrom}-${verseTo}`:`${surahFrom} ayat ${verseFrom} sampai ${surahTo} ayat ${verseTo}`;
    message=`SINURMAN: Setoran tahfidz ${student.name} diperbarui: ${range}, jumlah ${row.amount} ayat, nilai ${row.grade}.`;
  }
  if(resource==="health") message=`SINURMAN: Catatan kesehatan ${student.name}: ${row.complaint}. Status ${row.status}.`;
  if(resource==="bills") message=`SINURMAN: Tagihan baru ${row.category} untuk ${student.name} sebesar Rp${Number(row.amount||0).toLocaleString("id-ID")}, jatuh tempo ${row.due_date}.`;
  if(resource==="permits"&&["Disetujui","Ditolak"].includes(String(row.status))) message=`SINURMAN: Pengajuan izin ${student.name} telah ${String(row.status).toLowerCase()}.`;
  if(resource==="grades") message=`SINURMAN: Nilai akademik ${student.name} diperbarui. Nilai akhir ${row.final_score} (predikat ${row.predicate}) untuk semester ${row.semester}.`;
  if(resource==="characters") message=`SINURMAN: Nilai karakter ${student.name} untuk ${row.category} diperbarui menjadi ${row.score}.`;
  if(resource==="counseling"&&["Pelanggaran","Prestasi"].includes(String(row.type))) message=`SINURMAN: Catatan ${String(row.type).toLowerCase()} ${student.name}: ${row.category}. Status ${row.status}.`;
  if(message) await notifyGuardian(studentId,message);
}
