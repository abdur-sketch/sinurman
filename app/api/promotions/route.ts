import { database, ensureUser, seedIfNeeded } from "../_lib";

type Student = { id:number; name:string; nis:string; class_name:string; status:string };
type SchoolClass = { name:string; education_level:string; next_class_name:string };

function automaticDestination(className:string, level:string) {
  const name=className.trim();
  const rules: Array<[RegExp,string]> = level==="SMP"
    ? [[/^VIII(?=\s|$)/,"IX"],[/^VII(?=\s|$)/,"VIII"]]
    : [[/^XI(?=\s|$)/,"XII"],[/^X(?=\s|$)/,"XI"]];
  if ((level==="SMP"&&/^IX(?=\s|$)/.test(name))||(level==="SMK"&&/^XII(?=\s|$)/.test(name))) {
    return {toClass:`Alumni ${level}`,action:"Alumni" as const};
  }
  for (const [pattern,replacement] of rules) {
    if(pattern.test(name)) return {toClass:name.replace(pattern,replacement),action:"Naik Kelas" as const};
  }
  return null;
}

function classDetails(name:string, fallbackLevel:string) {
  const level=/^(VII|VIII|IX)(?=\s|$)/.test(name)?"SMP":fallbackLevel;
  const grade=/^XII(?=\s|$)/.test(name)?12:/^XI(?=\s|$)/.test(name)?11:/^X(?=\s|$)/.test(name)?10:/^IX(?=\s|$)/.test(name)?9:/^VIII(?=\s|$)/.test(name)?8:7;
  const major=level==="SMK"?name.replace(/^(XII|XI|X)(?=\s|$)\s*/,""):"";
  return {level,grade,major};
}

export async function POST(request:Request) {
  try {
    const user=await ensureUser(request);
    if(user.role!=="Admin") return Response.json({error:"Hanya Admin yang dapat memproses kenaikan kelas."},{status:403});
    await seedIfNeeded();
    const body=await request.json() as {academicYearFrom?:string;academicYearTo?:string};
    const academicYearFrom=String(body.academicYearFrom??"").trim();
    const academicYearTo=String(body.academicYearTo??"").trim();
    if(!/^\d{4}\/\d{4}$/.test(academicYearFrom)||!/^\d{4}\/\d{4}$/.test(academicYearTo)) {
      return Response.json({error:"Tahun ajaran harus menggunakan format 2026/2027."},{status:400});
    }
    if(academicYearFrom===academicYearTo) return Response.json({error:"Tahun ajaran tujuan harus berbeda."},{status:400});

    const db=database();
    const [studentResult,classResult,historyResult]=await Promise.all([
      db.prepare("SELECT id,name,nis,class_name,status FROM students WHERE status NOT IN ('Alumni','Nonaktif') AND class_name NOT LIKE 'Alumni%' ORDER BY id").all<Student>(),
      db.prepare("SELECT name,education_level,next_class_name FROM school_classes WHERE status='Aktif'").all<SchoolClass>(),
      db.prepare("SELECT student_id FROM student_promotions WHERE academic_year_from=?").bind(academicYearFrom).all<{student_id:number}>(),
    ]);
    const classes=new Map(classResult.results.map(row=>[row.name,row]));
    const processed=new Set(historyResult.results.map(row=>Number(row.student_id)));
    const now=new Date().toISOString();
    let promoted=0;
    let alumni=0;
    let skipped=0;
    const statements:D1PreparedStatement[]=[];

    for(const student of studentResult.results) {
      if(processed.has(student.id)){skipped++;continue;}
      const sourceClass=classes.get(student.class_name);
      const level=sourceClass?.education_level||(/^(VII|VIII|IX)(?=\s|$)/.test(student.class_name)?"SMP":"SMK");
      const automatic=automaticDestination(student.class_name,level);
      const destination=automatic?.action==="Alumni"
        ? automatic
        : sourceClass?.next_class_name
          ? {toClass:sourceClass.next_class_name,action:"Naik Kelas" as const}
          : automatic;
      if(!destination){skipped++;continue;}
      if(destination.action==="Alumni") alumni++; else promoted++;
      statements.push(
        db.prepare(`INSERT OR IGNORE INTO student_promotions
          (student_id,student_name,nis,from_class,to_class,action,academic_year_from,academic_year_to,processed_by,processed_at)
          VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(student.id,student.name,student.nis,student.class_name,destination.toClass,destination.action,academicYearFrom,academicYearTo,user.email,now),
        destination.action==="Alumni"
          ? db.prepare("UPDATE students SET class_name=?,status='Alumni' WHERE id=?").bind(destination.toClass,student.id)
          : db.prepare("UPDATE students SET class_name=? WHERE id=?").bind(destination.toClass,student.id),
      );
      if(destination.action==="Naik Kelas"&&!classes.has(destination.toClass)) {
        const details=classDetails(destination.toClass,level);
        statements.push(db.prepare(`INSERT OR IGNORE INTO school_classes
          (name,education_level,grade_order,major,homeroom_teacher,capacity,next_class_name,academic_year,status,created_at,updated_at)
          VALUES (?,?,?,?,?,32,'',?,'Aktif',?,?)`)
          .bind(destination.toClass,details.level,details.grade,details.major,"",academicYearTo,now,now));
        classes.set(destination.toClass,{name:destination.toClass,education_level:details.level,next_class_name:""});
      }
    }
    for(let index=0;index<statements.length;index+=75) await db.batch(statements.slice(index,index+75));
    await db.batch([
      db.prepare("UPDATE school_classes SET academic_year=?,updated_at=? WHERE status='Aktif'").bind(academicYearTo,now),
      db.prepare("INSERT INTO audit_logs (user_email,action,resource,detail,created_at) VALUES (?,?,?,?,?)")
        .bind(user.email,"Proses","student_promotions",`Kenaikan ${academicYearFrom} ke ${academicYearTo}: ${promoted} naik kelas, ${alumni} alumni, ${skipped} dilewati`,now),
    ]);
    return Response.json({ok:true,promoted,alumni,skipped,total:promoted+alumni});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:"Proses kenaikan kelas gagal."},{status:500});
  }
}
