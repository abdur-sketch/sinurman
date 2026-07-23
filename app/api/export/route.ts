import { PDFDocument, PDFPage, PDFFont, StandardFonts, rgb } from "pdf-lib";
import { database, ensureUser } from "../_lib";

type Column = { key:string; label:string; weight?:number };
type ExportDefinition = {
  title:string;
  description:string;
  query:string;
  scopedQuery?:string;
  columns:Column[];
  dateKey?:string;
  adminOnly?:boolean;
};

const exports:Record<string,ExportDefinition> = {
  students: {
    title:"Laporan Data Santri",
    description:"Profil santri, kelas, kamar, wali, dan status aktif.",
    query:"SELECT nis,name,class_name,room,guardian_name,status FROM students ORDER BY name",
    scopedQuery:"SELECT nis,name,class_name,room,guardian_name,status FROM students WHERE room=? ORDER BY name",
    columns:[{key:"nis",label:"NIS"},{key:"name",label:"Nama Santri",weight:1.7},{key:"class_name",label:"Kelas"},{key:"room",label:"Kamar",weight:1.2},{key:"guardian_name",label:"Wali",weight:1.4},{key:"status",label:"Status"}],
  },
  tahfidz: {
    title:"Rekap Setoran Tahfidz",
    description:"Setoran hafalan, jumlah ayat, penilaian, dan pembimbing.",
    query:"SELECT s.name AS santri,t.surah_from,t.verse_from,t.surah_to,t.verse_to,t.amount,t.grade,t.teacher,t.recorded_at FROM tahfidz_records t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC",
    scopedQuery:"SELECT s.name AS santri,t.surah_from,t.verse_from,t.surah_to,t.verse_to,t.amount,t.grade,t.teacher,t.recorded_at FROM tahfidz_records t JOIN students s ON s.id=t.student_id WHERE s.room=? ORDER BY t.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.5},{key:"surah_from",label:"Surat Awal",weight:1.1},{key:"verse_from",label:"Ayat Awal"},{key:"surah_to",label:"Surat Akhir",weight:1.1},{key:"verse_to",label:"Ayat Akhir"},{key:"amount",label:"Jumlah"},{key:"grade",label:"Nilai"},{key:"teacher",label:"Pembimbing",weight:1.2},{key:"recorded_at",label:"Tanggal",weight:1.1}],
    dateKey:"recorded_at",
  },
  mutabaah: {
    title:"Rekap Mutaba'ah",
    description:"Pelaksanaan ibadah dan kegiatan harian santri.",
    query:"SELECT s.name AS santri,m.activity,m.completed,m.record_date,m.recorded_by FROM mutabaah_records m JOIN students s ON s.id=m.student_id ORDER BY m.id DESC",
    scopedQuery:"SELECT s.name AS santri,m.activity,m.completed,m.record_date,m.recorded_by FROM mutabaah_records m JOIN students s ON s.id=m.student_id WHERE s.room=? ORDER BY m.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.6},{key:"activity",label:"Kegiatan",weight:1.8},{key:"completed",label:"Status"},{key:"record_date",label:"Tanggal"},{key:"recorded_by",label:"Pencatat",weight:1.4}],
    dateKey:"record_date",
  },
  attendance: {
    title:"Laporan Absensi Santri",
    description:"Kehadiran, izin, sakit, dan alpa santri.",
    query:"SELECT s.name AS santri,s.class_name,a.record_date,a.status,a.note,a.recorded_by FROM attendance_records a JOIN students s ON s.id=a.student_id ORDER BY a.id DESC",
    scopedQuery:"SELECT s.name AS santri,s.class_name,a.record_date,a.status,a.note,a.recorded_by FROM attendance_records a JOIN students s ON s.id=a.student_id WHERE s.room=? ORDER BY a.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.5},{key:"class_name",label:"Kelas"},{key:"record_date",label:"Tanggal"},{key:"status",label:"Status"},{key:"note",label:"Catatan",weight:1.8},{key:"recorded_by",label:"Pencatat",weight:1.3}],
    dateKey:"record_date",
  },
  characters: {
    title:"Rapor Karakter Santri",
    description:"Nilai karakter, semester, dan catatan pembina.",
    query:"SELECT s.name AS santri,c.category,c.score,c.semester,c.note,c.recorded_at FROM character_reports c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC",
    scopedQuery:"SELECT s.name AS santri,c.category,c.score,c.semester,c.note,c.recorded_at FROM character_reports c JOIN students s ON s.id=c.student_id WHERE s.room=? ORDER BY c.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.5},{key:"category",label:"Karakter",weight:1.2},{key:"score",label:"Nilai"},{key:"semester",label:"Semester",weight:1.2},{key:"note",label:"Catatan",weight:2},{key:"recorded_at",label:"Tanggal"}],
    dateKey:"recorded_at",
  },
  health: {
    title:"Rekap Kesehatan Santri",
    description:"Keluhan, diagnosis, penanganan, dan status kesehatan.",
    query:"SELECT s.name AS santri,h.complaint,h.diagnosis,h.treatment,h.status,h.recorded_at FROM health_records h JOIN students s ON s.id=h.student_id ORDER BY h.id DESC",
    scopedQuery:"SELECT s.name AS santri,h.complaint,h.diagnosis,h.treatment,h.status,h.recorded_at FROM health_records h JOIN students s ON s.id=h.student_id WHERE s.room=? ORDER BY h.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.4},{key:"complaint",label:"Keluhan",weight:1.5},{key:"diagnosis",label:"Diagnosis",weight:1.4},{key:"treatment",label:"Penanganan",weight:1.5},{key:"status",label:"Status"},{key:"recorded_at",label:"Tanggal"}],
    dateKey:"recorded_at",
  },
  counseling: {
    title:"Laporan Konseling dan Pembinaan",
    description:"Prestasi, pembinaan, pelanggaran, poin, dan tindak lanjut.",
    query:"SELECT s.name AS santri,c.type,c.category,c.description,c.points,c.status,c.counselor,c.recorded_at FROM counseling_records c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC",
    scopedQuery:"SELECT s.name AS santri,c.type,c.category,c.description,c.points,c.status,c.counselor,c.recorded_at FROM counseling_records c JOIN students s ON s.id=c.student_id WHERE s.room=? ORDER BY c.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.4},{key:"type",label:"Jenis"},{key:"category",label:"Kategori"},{key:"description",label:"Catatan",weight:1.8},{key:"points",label:"Poin"},{key:"status",label:"Status"},{key:"counselor",label:"Pembina",weight:1.2},{key:"recorded_at",label:"Tanggal"}],
    dateKey:"recorded_at",
  },
  schedules: {
    title:"Jadwal Pelajaran Harian",
    description:"Jadwal pelajaran SMP dan SMK berdasarkan kelas.",
    query:"SELECT education_level,class_name,day_name,start_time,end_time,title,category,teacher,location FROM schedules ORDER BY education_level,class_name,CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END,start_time",
    scopedQuery:"SELECT education_level,class_name,day_name,start_time,end_time,title,category,teacher,location FROM schedules WHERE class_name IN (SELECT class_name FROM students WHERE room=?) ORDER BY class_name,CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END,start_time",
    columns:[{key:"education_level",label:"Jenjang"},{key:"class_name",label:"Kelas"},{key:"day_name",label:"Hari"},{key:"start_time",label:"Mulai"},{key:"end_time",label:"Selesai"},{key:"title",label:"Pelajaran",weight:1.5},{key:"category",label:"Kategori"},{key:"teacher",label:"Pengajar",weight:1.2},{key:"location",label:"Lokasi"}],
  },
  finance: {
    title:"Laporan Keuangan",
    description:"Transaksi SPP, uang saku, pemasukan, dan pengeluaran.",
    query:"SELECT s.name AS santri,t.type,t.category,t.amount,t.status,t.note,t.recorded_at FROM transactions t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC",
    columns:[{key:"santri",label:"Santri",weight:1.4},{key:"type",label:"Jenis"},{key:"category",label:"Kategori",weight:1.2},{key:"amount",label:"Nominal",weight:1.2},{key:"status",label:"Status"},{key:"note",label:"Catatan",weight:1.8},{key:"recorded_at",label:"Tanggal"}],
    dateKey:"recorded_at",
    adminOnly:true,
  },
  inventory: {
    title:"Laporan Inventaris",
    description:"Aset pesantren, jumlah, satuan, lokasi, dan kondisi.",
    query:"SELECT name,location,quantity,unit,condition,updated_at FROM inventory_items ORDER BY name",
    columns:[{key:"name",label:"Barang",weight:1.8},{key:"location",label:"Lokasi",weight:1.4},{key:"quantity",label:"Jumlah"},{key:"unit",label:"Satuan"},{key:"condition",label:"Kondisi"},{key:"updated_at",label:"Diperbarui",weight:1.2}],
    dateKey:"updated_at",
    adminOnly:true,
  },
  admissions: {
    title:"Laporan Penerimaan Santri Baru",
    description:"Data pendaftar, jenjang pilihan, asal sekolah, nilai, dan verifikasi.",
    query:"SELECT registration_no,name,desired_level,previous_school,guardian_name,status,score,created_at FROM admissions ORDER BY id DESC",
    columns:[{key:"registration_no",label:"No. Daftar",weight:1.2},{key:"name",label:"Calon Santri",weight:1.5},{key:"desired_level",label:"Jenjang"},{key:"previous_school",label:"Asal Sekolah",weight:1.5},{key:"guardian_name",label:"Wali",weight:1.3},{key:"status",label:"Status"},{key:"score",label:"Nilai"},{key:"created_at",label:"Tanggal"}],
    dateKey:"created_at",
    adminOnly:true,
  },
};

function csvValue(value:unknown) {
  return `"${String(value??"").replaceAll('"','""')}"`;
}

function dateLabel(value:string) {
  if(!value) return "";
  const date=new Date(`${value.slice(0,10)}T00:00:00`);
  return Number.isNaN(date.getTime())?value:new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"long",year:"numeric"}).format(date);
}

function displayValue(key:string,value:unknown) {
  if(value===null||value===undefined||value==="") return "-";
  if(key==="amount") return `Rp ${new Intl.NumberFormat("id-ID").format(Number(value))}`;
  if(key==="completed") return Number(value)?"Selesai":"Belum";
  if(key.endsWith("_at")||key.endsWith("_date")) return dateLabel(String(value));
  return String(value);
}

function safePdfText(value:unknown) {
  return String(value??"")
    .replace(/[‘’]/g,"'")
    .replace(/[–—]/g,"-")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g,"?");
}

function truncate(font:PDFFont,value:string,maxWidth:number,size:number) {
  const text=safePdfText(value);
  if(font.widthOfTextAtSize(text,size)<=maxWidth) return text;
  let result=text;
  while(result.length&&font.widthOfTextAtSize(`${result}...`,size)>maxWidth) result=result.slice(0,-1);
  return `${result}...`;
}

function drawPdfHeader(page:PDFPage,title:string,period:string,font:PDFFont,bold:PDFFont,pageNumber:number) {
  const {width,height}=page.getSize();
  page.drawRectangle({x:0,y:height-68,width,height:68,color:rgb(.07,.18,.31)});
  page.drawRectangle({x:0,y:height-72,width,height:4,color:rgb(.17,.48,.9)});
  page.drawText("SINURMAN",{x:30,y:height-35,size:18,font:bold,color:rgb(1,1,1)});
  page.drawText("PONDOK PESANTREN NURUL IMAN",{x:30,y:height-51,size:7.5,font,color:rgb(.76,.85,.95)});
  page.drawText(safePdfText(title),{x:260,y:height-35,size:14,font:bold,color:rgb(1,1,1)});
  page.drawText(safePdfText(period),{x:260,y:height-50,size:7.5,font,color:rgb(.76,.85,.95)});
  page.drawText(`Halaman ${pageNumber}`,{x:width-78,y:height-50,size:7.5,font,color:rgb(.76,.85,.95)});
}

function drawTableHeader(page:PDFPage,columns:Column[],widths:number[],y:number,font:PDFFont,bold:PDFFont) {
  page.drawRectangle({x:30,y:y-18,width:782,height:20,color:rgb(.9,.94,.98)});
  let x=34;
  page.drawText("No.",{x,y:y-11,size:7,font:bold,color:rgb(.08,.2,.34)});
  x+=28;
  columns.forEach((column,index)=>{
    page.drawText(truncate(bold,column.label,widths[index]-7,7),{x,y:y-11,size:7,font:bold,color:rgb(.08,.2,.34)});
    x+=widths[index];
  });
  return y-20;
}

async function createPdf(config:ExportDefinition,rows:Record<string,unknown>[],period:string,preparedBy:string) {
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const totalWeight=config.columns.reduce((sum,column)=>sum+(column.weight??1),0);
  const widths=config.columns.map(column=>754*((column.weight??1)/totalWeight));
  let pageNumber=1;
  let page=pdf.addPage([842,595]);
  drawPdfHeader(page,config.title,period,font,bold,pageNumber);
  let y=500;
  y=drawTableHeader(page,config.columns,widths,y,font,bold);
  rows.forEach((row,rowIndex)=>{
    if(y<82) {
      pageNumber+=1;
      page=pdf.addPage([842,595]);
      drawPdfHeader(page,config.title,period,font,bold,pageNumber);
      y=500;
      y=drawTableHeader(page,config.columns,widths,y,font,bold);
    }
    if(rowIndex%2===1) page.drawRectangle({x:30,y:y-17,width:782,height:18,color:rgb(.975,.985,.995)});
    let x=34;
    page.drawText(String(rowIndex+1),{x,y:y-12,size:6.6,font,color:rgb(.2,.26,.34)});
    x+=28;
    config.columns.forEach((column,index)=>{
      const value=displayValue(column.key,row[column.key]);
      page.drawText(truncate(font,value,widths[index]-7,6.6),{x,y:y-12,size:6.6,font,color:rgb(.2,.26,.34)});
      x+=widths[index];
    });
    y-=18;
  });
  if(y<115) {
    pageNumber+=1;
    page=pdf.addPage([842,595]);
    drawPdfHeader(page,config.title,period,font,bold,pageNumber);
    y=485;
  }
  page.drawText("Mengetahui, Pimpinan Pesantren",{x:55,y:y-30,size:7.5,font,color:rgb(.35,.42,.5)});
  page.drawText("Petugas yang mencetak",{x:590,y:y-30,size:7.5,font,color:rgb(.35,.42,.5)});
  page.drawLine({start:{x:55,y:y-77},end:{x:210,y:y-77},thickness:.6,color:rgb(.45,.5,.56)});
  page.drawLine({start:{x:590,y:y-77},end:{x:770,y:y-77},thickness:.6,color:rgb(.45,.5,.56)});
  page.drawText(truncate(bold,preparedBy,170,8),{x:590,y:y-90,size:8,font:bold,color:rgb(.08,.2,.34)});
  const pages=pdf.getPages();
  pages.forEach((current,index)=>{
    current.drawLine({start:{x:30,y:24},end:{x:812,y:24},thickness:.5,color:rgb(.82,.86,.9)});
    current.drawText(`Dokumen resmi SINURMAN - ${rows.length} data`,{x:30,y:12,size:6.5,font,color:rgb(.45,.5,.56)});
    current.drawText(`${index+1} / ${pages.length}`,{x:785,y:12,size:6.5,font,color:rgb(.45,.5,.56)});
  });
  return pdf.save();
}

export async function GET(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.role==="Wali Santri") return Response.json({error:"Laporan lengkap hanya tersedia untuk pengurus."},{status:403});
    const url=new URL(request.url);
    const type=url.searchParams.get("type")??"students";
    const format=url.searchParams.get("format")??"csv";
    const from=url.searchParams.get("from")?.slice(0,10)??"";
    const to=url.searchParams.get("to")?.slice(0,10)??"";
    const config=exports[type];
    if(!config) return Response.json({error:"Jenis laporan tidak valid."},{status:400});
    if(config.adminOnly&&user.role!=="Admin") return Response.json({error:"Laporan ini hanya tersedia untuk Admin."},{status:403});
    const scoped=user.role==="Musyrif"||user.role==="Kepala Asrama";
    const statement=database().prepare(scoped&&config.scopedQuery?config.scopedQuery:config.query);
    const result=scoped&&config.scopedQuery?await statement.bind(user.roomScope||"__BELUM_DITUGASKAN__").all<Record<string,unknown>>():await statement.all<Record<string,unknown>>();
    const rows=config.dateKey?result.results.filter(row=>{
      const value=String(row[config.dateKey!]??"").slice(0,10);
      return (!from||value>=from)&&(!to||value<=to);
    }):result.results;
    const generatedAt=new Intl.DateTimeFormat("id-ID",{dateStyle:"long",timeStyle:"short",timeZone:"Asia/Jakarta"}).format(new Date());
    const periodLabel=from&&to?`${dateLabel(from)} - ${dateLabel(to)}`:from?`Mulai ${dateLabel(from)}`:to?`Sampai ${dateLabel(to)}`:"Seluruh data";
    if(format==="json") return Response.json({
      title:config.title,
      description:config.description,
      columns:config.columns.map(({key,label})=>({key,label})),
      rows,
      generatedAt,
      period:{from,to,label:config.dateKey?periodLabel:"Seluruh data aktif"},
      preparedBy:{name:user.name,role:user.role,roomScope:user.roomScope},
    });
    if(format==="pdf") {
      const bytes=await createPdf(config,rows,config.dateKey?periodLabel:"Seluruh data aktif",user.name);
      return new Response(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="sinurman-${type}.pdf"`}});
    }
    if(format!=="csv") return Response.json({error:"Format laporan tidak valid."},{status:400});
    const csv=[config.columns.map(column=>csvValue(column.label)).join(","),...rows.map(row=>config.columns.map(column=>csvValue(displayValue(column.key,row[column.key]))).join(","))].join("\n");
    return new Response(`\uFEFF${csv}`,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="sinurman-${type}.csv"`}});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Ekspor gagal."},{status:500});
  }
}
