import { database, ensureUser, seedIfNeeded } from "../_lib";
import { reportServerError } from "../../../lib/observability";

export async function GET(request: Request) {
  try {
    const db = database();
    const user = await ensureUser(request);
    let seedWarning = "";
    try {
      await seedIfNeeded();
    } catch (error) {
      seedWarning = error instanceof Error ? error.message : "Data contoh belum dapat disiapkan.";
    }
    const guardian = user.role === "Wali Santri";
    const staff = user.role === "Musyrif" || user.role === "Kepala Asrama";
    const guardianKey = user.guardianPhone || user.email.toLocaleLowerCase("id-ID");
    const roomScope = user.roomScope || "__BELUM_DITUGASKAN__";
    const safe = async (operation: Promise<D1Result<unknown>>) => {
      try { return await operation; }
      catch { return { results: [] } as unknown as D1Result<unknown>; }
    };
    const all = (query: string) => safe(db.prepare(query).all());
    const owned = (query: string) => {
      const scopedQuery = user.guardianPhone
        ? query
          .replaceAll("lower(s.guardian_email)", "s.guardian_phone")
          .replaceAll("lower(guardian_email)", "guardian_phone")
          .replaceAll("lower(a.applicant_email)", "a.guardian_phone")
          .replaceAll("lower(applicant_email)", "guardian_phone")
          .replaceAll("lower(g.sender_email)", "s.guardian_phone")
        : query;
      return safe(db.prepare(scopedQuery).bind(guardianKey).all());
    };
    const scoped = (query: string) => safe(db.prepare(query).bind(roomScope).all());

    const [
      students,
      employees,
      classes,
      promotionHistory,
      tahfidz,
      tahsin,
      mutabaah,
      health,
      transactions,
      inventory,
      announcements,
      characters,
      notifications,
      attendance,
      subjects,
      grades,
      permits,
      schedules,
      rooms,
      admissions,
      admissionDocuments,
      counseling,
      bills,
      users,
      audit,
      guardianMessages,
      guardianRequests,
      walletAccounts,
      walletEntries,
      walletTopups,
      canteenProducts,
      canteenSales,
      canteenSaleItems,
      guardianAccounts,
    ] = await Promise.all([
      guardian
        ? owned("SELECT * FROM students WHERE lower(guardian_email) = ? ORDER BY id")
        : staff ? scoped("SELECT * FROM students WHERE room=? ORDER BY id")
        : all("SELECT * FROM students ORDER BY id DESC"),
      user.role === "Admin"
        ? all("SELECT * FROM employees ORDER BY name")
        : all("SELECT * FROM employees WHERE 1=0"),
      guardian
        ? all("SELECT * FROM school_classes WHERE 1=0")
        : all("SELECT * FROM school_classes ORDER BY education_level,grade_order,name"),
      user.role === "Admin"
        ? all("SELECT * FROM student_promotions ORDER BY id DESC LIMIT 500")
        : all("SELECT * FROM student_promotions WHERE 1=0"),
      guardian
        ? owned("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? AND t.workflow_status='Dipublikasikan' ORDER BY t.id DESC LIMIT 100")
        : staff ? scoped("SELECT t.*,s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id=t.student_id WHERE s.room=? ORDER BY t.id DESC LIMIT 100")
        : all("SELECT t.*, s.name AS student_name FROM tahfidz_records t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT t.*, s.name AS student_name FROM tahsin_records t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? AND t.workflow_status='Dipublikasikan' ORDER BY t.id DESC LIMIT 100")
        : staff ? scoped("SELECT t.*,s.name AS student_name FROM tahsin_records t JOIN students s ON s.id=t.student_id WHERE s.room=? ORDER BY t.id DESC LIMIT 100")
        : all("SELECT t.*, s.name AS student_name FROM tahsin_records t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT m.*, s.name AS student_name FROM mutabaah_records m JOIN students s ON s.id=m.student_id WHERE lower(s.guardian_email)=? AND m.workflow_status='Dipublikasikan' ORDER BY m.id DESC LIMIT 100")
        : staff ? scoped("SELECT m.*,s.name AS student_name FROM mutabaah_records m JOIN students s ON s.id=m.student_id WHERE s.room=? ORDER BY m.id DESC LIMIT 100")
        : all("SELECT m.*, s.name AS student_name FROM mutabaah_records m JOIN students s ON s.id=m.student_id ORDER BY m.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id=h.student_id WHERE lower(s.guardian_email)=? AND h.workflow_status='Dipublikasikan' ORDER BY h.id DESC LIMIT 100")
        : staff ? scoped("SELECT h.*,s.name AS student_name FROM health_records h JOIN students s ON s.id=h.student_id WHERE s.room=? ORDER BY h.id DESC LIMIT 100")
        : all("SELECT h.*, s.name AS student_name FROM health_records h JOIN students s ON s.id=h.student_id ORDER BY h.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? ORDER BY t.id DESC LIMIT 150")
        : staff ? all("SELECT * FROM transactions WHERE 1=0")
        : all("SELECT t.*, s.name AS student_name FROM transactions t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 150"),
      guardian || staff
        ? all("SELECT * FROM inventory_items WHERE 1=0")
        : all("SELECT * FROM inventory_items ORDER BY id DESC"),
      guardian
        ? all("SELECT * FROM announcements WHERE audience IN ('Semua','Wali Santri') ORDER BY id DESC LIMIT 50")
        : all("SELECT * FROM announcements ORDER BY id DESC"),
      guardian
        ? owned("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id=c.student_id WHERE lower(s.guardian_email)=? AND c.workflow_status='Dipublikasikan' ORDER BY c.id DESC LIMIT 100")
        : staff ? scoped("SELECT c.*,s.name AS student_name FROM character_reports c JOIN students s ON s.id=c.student_id WHERE s.room=? ORDER BY c.id DESC LIMIT 100")
        : all("SELECT c.*, s.name AS student_name FROM character_reports c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT n.* FROM notification_logs n JOIN students s ON s.id=n.student_id WHERE lower(s.guardian_email)=? ORDER BY n.id DESC LIMIT 30")
        : staff ? scoped("SELECT n.* FROM notification_logs n JOIN students s ON s.id=n.student_id WHERE s.room=? ORDER BY n.id DESC LIMIT 30")
        : all("SELECT * FROM notification_logs ORDER BY id DESC LIMIT 30"),
      guardian
        ? owned("SELECT a.*, s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id WHERE lower(s.guardian_email)=? AND a.workflow_status='Dipublikasikan' ORDER BY a.id DESC LIMIT 100")
        : staff ? scoped("SELECT a.*,s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id WHERE s.room=? ORDER BY a.id DESC LIMIT 100")
        : all("SELECT a.*, s.name AS student_name FROM attendance_records a JOIN students s ON s.id=a.student_id ORDER BY a.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT a.* FROM academic_subjects a WHERE a.class_name IN (SELECT class_name FROM students WHERE lower(guardian_email)=?) ORDER BY a.class_name,a.name")
        : staff ? scoped("SELECT a.* FROM academic_subjects a WHERE a.class_name IN (SELECT class_name FROM students WHERE room=?) ORDER BY a.class_name,a.name")
        : all("SELECT * FROM academic_subjects ORDER BY education_level,class_name,name"),
      guardian
        ? owned("SELECT g.*,s.name AS student_name,a.name AS subject_name,a.code AS subject_code,a.minimum_score FROM academic_grades g JOIN students s ON s.id=g.student_id JOIN academic_subjects a ON a.id=g.subject_id WHERE lower(s.guardian_email)=? AND g.workflow_status='Dipublikasikan' ORDER BY g.id DESC LIMIT 200")
        : staff ? scoped("SELECT g.*,s.name AS student_name,a.name AS subject_name,a.code AS subject_code,a.minimum_score FROM academic_grades g JOIN students s ON s.id=g.student_id JOIN academic_subjects a ON a.id=g.subject_id WHERE s.room=? ORDER BY g.id DESC LIMIT 200")
        : all("SELECT g.*,s.name AS student_name,a.name AS subject_name,a.code AS subject_code,a.minimum_score FROM academic_grades g JOIN students s ON s.id=g.student_id JOIN academic_subjects a ON a.id=g.subject_id ORDER BY g.id DESC LIMIT 300"),
      guardian
        ? owned("SELECT p.*, s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id WHERE lower(s.guardian_email)=? ORDER BY p.id DESC LIMIT 50")
        : staff ? scoped("SELECT p.*,s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id WHERE s.room=? ORDER BY p.id DESC LIMIT 50")
        : all("SELECT p.*, s.name AS student_name FROM leave_permits p JOIN students s ON s.id=p.student_id ORDER BY p.id DESC LIMIT 50"),
      guardian
        ? owned("SELECT * FROM schedules WHERE class_name IN (SELECT class_name FROM students WHERE lower(guardian_email)=?) ORDER BY education_level, class_name, CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, start_time")
        : staff ? scoped("SELECT * FROM schedules WHERE class_name IN (SELECT class_name FROM students WHERE room=?) ORDER BY class_name,day_name,start_time")
        : all("SELECT * FROM schedules ORDER BY education_level, class_name, CASE day_name WHEN 'Senin' THEN 1 WHEN 'Selasa' THEN 2 WHEN 'Rabu' THEN 3 WHEN 'Kamis' THEN 4 WHEN 'Jumat' THEN 5 WHEN 'Sabtu' THEN 6 ELSE 7 END, start_time"),
      guardian
        ? owned("SELECT * FROM rooms WHERE name IN (SELECT room FROM students WHERE lower(guardian_email)=?) ORDER BY name")
        : staff ? scoped("SELECT * FROM rooms WHERE name=?")
        : all("SELECT * FROM rooms ORDER BY name"),
      guardian
        ? owned("SELECT * FROM admissions WHERE lower(applicant_email)=? ORDER BY id DESC")
        : staff ? all("SELECT * FROM admissions WHERE 1=0")
        : all("SELECT * FROM admissions ORDER BY id DESC"),
      guardian
        ? owned("SELECT d.* FROM admission_documents d JOIN admissions a ON a.id=d.admission_id WHERE lower(a.applicant_email)=? ORDER BY d.id DESC")
        : staff ? all("SELECT * FROM admission_documents WHERE 1=0")
        : all("SELECT * FROM admission_documents ORDER BY id DESC"),
      guardian
        ? all("SELECT c.*, s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id WHERE 1=0")
        : staff ? scoped("SELECT c.*,s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id WHERE s.room=? ORDER BY c.id DESC LIMIT 100")
        : all("SELECT c.*, s.name AS student_name FROM counseling_records c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT b.*, s.name AS student_name FROM bills b JOIN students s ON s.id=b.student_id WHERE lower(s.guardian_email)=? ORDER BY b.id DESC LIMIT 100")
        : staff ? all("SELECT * FROM bills WHERE 1=0")
        : all("SELECT b.*, s.name AS student_name FROM bills b JOIN students s ON s.id=b.student_id ORDER BY b.id DESC LIMIT 100"),
      guardian || staff
        ? owned("SELECT id,email,name,role,room_scope,created_at FROM users WHERE lower(email)=?")
        : all("SELECT id,email,name,role,room_scope,created_at FROM users ORDER BY id"),
      guardian || staff
        ? all("SELECT * FROM audit_logs WHERE 1=0")
        : all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100"),
      guardian
        ? owned("SELECT g.*, s.name AS student_name FROM guardian_messages g JOIN students s ON s.id=g.student_id WHERE lower(g.sender_email)=? ORDER BY g.id DESC LIMIT 50")
        : staff ? all("SELECT * FROM guardian_messages WHERE 1=0")
        : all("SELECT g.*, s.name AS student_name FROM guardian_messages g JOIN students s ON s.id=g.student_id ORDER BY g.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT g.*,s.name AS student_name,s.nis FROM guardian_requests g JOIN students s ON s.id=g.student_id WHERE lower(s.guardian_email)=? ORDER BY g.id DESC LIMIT 50")
        : staff ? scoped("SELECT g.*,s.name AS student_name,s.nis FROM guardian_requests g JOIN students s ON s.id=g.student_id WHERE s.room=? ORDER BY g.id DESC LIMIT 100")
        : all("SELECT g.*,s.name AS student_name,s.nis FROM guardian_requests g JOIN students s ON s.id=g.student_id ORDER BY g.id DESC LIMIT 100"),
      guardian
        ? owned("SELECT w.id,w.student_id,w.balance,w.daily_limit,w.status,w.updated_at,s.name AS student_name,s.nis FROM wallet_accounts w JOIN students s ON s.id=w.student_id WHERE lower(s.guardian_email)=? ORDER BY s.name")
        : staff ? all("SELECT * FROM wallet_accounts WHERE 1=0")
        : all("SELECT w.*,s.name AS student_name,s.nis,s.class_name,s.room FROM wallet_accounts w JOIN students s ON s.id=w.student_id ORDER BY s.name"),
      guardian
        ? owned("SELECT e.*,s.name AS student_name FROM wallet_entries e JOIN students s ON s.id=e.student_id WHERE lower(s.guardian_email)=? ORDER BY e.id DESC LIMIT 100")
        : staff ? all("SELECT * FROM wallet_entries WHERE 1=0")
        : all("SELECT e.*,s.name AS student_name FROM wallet_entries e JOIN students s ON s.id=e.student_id ORDER BY e.id DESC LIMIT 200"),
      guardian
        ? owned("SELECT t.*,s.name AS student_name,s.nis FROM wallet_topups t JOIN students s ON s.id=t.student_id WHERE lower(s.guardian_email)=? ORDER BY t.id DESC LIMIT 100")
        : staff ? all("SELECT * FROM wallet_topups WHERE 1=0")
        : all("SELECT t.*,s.name AS student_name,s.nis FROM wallet_topups t JOIN students s ON s.id=t.student_id ORDER BY t.id DESC LIMIT 200"),
      guardian || staff
        ? all("SELECT * FROM canteen_products WHERE 1=0")
        : all("SELECT * FROM canteen_products ORDER BY category,name"),
      guardian
        ? owned("SELECT c.*,s.name AS student_name,s.nis FROM canteen_sales c JOIN students s ON s.id=c.student_id WHERE lower(s.guardian_email)=? ORDER BY c.id DESC LIMIT 100")
        : staff ? all("SELECT * FROM canteen_sales WHERE 1=0")
        : all("SELECT c.*,s.name AS student_name,s.nis FROM canteen_sales c JOIN students s ON s.id=c.student_id ORDER BY c.id DESC LIMIT 150"),
      guardian
        ? owned("SELECT i.* FROM canteen_sale_items i JOIN canteen_sales c ON c.id=i.sale_id JOIN students s ON s.id=c.student_id WHERE lower(s.guardian_email)=? ORDER BY i.id DESC LIMIT 300")
        : staff ? all("SELECT * FROM canteen_sale_items WHERE 1=0")
        : all("SELECT * FROM canteen_sale_items ORDER BY id DESC LIMIT 500"),
      user.role === "Admin"
        ? all("SELECT id,phone,status,failed_attempts,locked_until,created_at,updated_at FROM guardian_accounts ORDER BY phone")
        : all("SELECT id,phone,status,failed_attempts,locked_until,created_at,updated_at FROM guardian_accounts WHERE 1=0"),
    ]);

    return Response.json({
      user,
      students: students.results,
      employees: employees.results,
      classes: classes.results,
      promotionHistory: promotionHistory.results,
      tahfidz: tahfidz.results,
      tahsin: tahsin.results,
      mutabaah: mutabaah.results,
      health: health.results,
      transactions: transactions.results,
      inventory: inventory.results,
      announcements: announcements.results,
      characters: characters.results,
      notifications: notifications.results,
      attendance: attendance.results,
      subjects: subjects.results,
      grades: grades.results,
      permits: permits.results,
      schedules: schedules.results,
      rooms: rooms.results,
      admissions: admissions.results,
      admissionDocuments: admissionDocuments.results,
      counseling: counseling.results,
      bills: bills.results,
      users: users.results,
      audit: audit.results,
      guardianMessages: guardianMessages.results,
      guardianRequests: guardianRequests.results,
      walletAccounts: walletAccounts.results,
      walletEntries: walletEntries.results,
      walletTopups: walletTopups.results,
      canteenProducts: canteenProducts.results,
      canteenSales: canteenSales.results,
      canteenSaleItems: canteenSaleItems.results,
      guardianAccounts: guardianAccounts.results,
      warning: seedWarning,
    });
  } catch (error) {
    const requestId=reportServerError("bootstrap.load",error,request);
    return Response.json(
      { error: error instanceof Error ? error.message : "Gagal memuat data.", requestId },
      { status: 500 },
    );
  }
}
