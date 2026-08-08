import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["Admin", "Kepala Asrama", "Musyrif", "Ustadz", "Wali Santri"] }).notNull(),
  roomScope: text("room_scope").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const students = sqliteTable("students", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  nis: text("nis").notNull().unique(),
  className: text("class_name").notNull(),
  room: text("room").notNull(),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  guardianEmail: text("guardian_email").notNull().default(""),
  status: text("status").notNull().default("Aktif"),
  createdAt: text("created_at").notNull(),
});

export const tahfidzRecords = sqliteTable("tahfidz_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  surah: text("surah").notNull(),
  verses: text("verses").notNull(),
  surahFrom: text("surah_from").notNull().default(""),
  surahTo: text("surah_to").notNull().default(""),
  verseFrom: integer("verse_from").notNull().default(0),
  verseTo: integer("verse_to").notNull().default(0),
  amount: integer("amount").notNull(),
  grade: text("grade").notNull(),
  teacher: text("teacher").notNull(),
  recordedAt: text("recorded_at").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const mutabaahRecords = sqliteTable("mutabaah_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  activity: text("activity").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  recordDate: text("record_date").notNull(),
  recordedBy: text("recorded_by").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const healthRecords = sqliteTable("health_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  complaint: text("complaint").notNull(),
  diagnosis: text("diagnosis").notNull(),
  treatment: text("treatment").notNull(),
  status: text("status").notNull(),
  recordedAt: text("recorded_at").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  type: text("type").notNull(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  recordedAt: text("recorded_at").notNull(),
});

export const characterReports = sqliteTable("character_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  category: text("category").notNull(),
  score: integer("score").notNull(),
  note: text("note").notNull(),
  semester: text("semester").notNull(),
  recordedAt: text("recorded_at").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const inventoryItems = sqliteTable("inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  location: text("location").notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  condition: text("condition").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  content: text("content").notNull(),
  audience: text("audience").notNull(),
  publishedAt: text("published_at").notNull(),
  author: text("author").notNull(),
});

export const notificationLogs = sqliteTable("notification_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").references(() => students.id),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull(),
  sentAt: text("sent_at").notNull(),
});

export const attendanceRecords = sqliteTable("attendance_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  recordDate: text("record_date").notNull(),
  status: text("status").notNull(),
  note: text("note").notNull(),
  recordedBy: text("recorded_by").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const academicSubjects = sqliteTable("academic_subjects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  educationLevel: text("education_level").notNull(),
  className: text("class_name").notNull(),
  teacher: text("teacher").notNull(),
  semester: text("semester").notNull(),
  academicYear: text("academic_year").notNull(),
  minimumScore: integer("minimum_score").notNull().default(75),
  createdAt: text("created_at").notNull(),
});

export const academicGrades = sqliteTable("academic_grades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  subjectId: integer("subject_id").notNull().references(() => academicSubjects.id),
  assignmentScore: integer("assignment_score").notNull(),
  midtermScore: integer("midterm_score").notNull(),
  examScore: integer("exam_score").notNull(),
  finalScore: integer("final_score").notNull(),
  predicate: text("predicate").notNull(),
  note: text("note").notNull(),
  semester: text("semester").notNull(),
  academicYear: text("academic_year").notNull(),
  recordedBy: text("recorded_by").notNull(),
  recordedAt: text("recorded_at").notNull(),
  workflowStatus: text("workflow_status").notNull().default("Dipublikasikan"),
  periodKey: text("period_key").notNull().default(""),
});

export const academicPeriods = sqliteTable("academic_periods", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  periodKey: text("period_key").notNull().unique(),
  academicYear: text("academic_year").notNull(),
  semester: text("semester").notNull(),
  status: text("status").notNull().default("Terbuka"),
  lockedBy: text("locked_by").notNull().default(""),
  lockedAt: text("locked_at").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const leavePermits = sqliteTable("leave_permits", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  approvedBy: text("approved_by").notNull(),
});

export const schedules = sqliteTable("schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  educationLevel: text("education_level").notNull().default("SMP"),
  className: text("class_name").notNull().default("VII A"),
  title: text("title").notNull(),
  category: text("category").notNull(),
  teacher: text("teacher").notNull(),
  location: text("location").notNull(),
  dayName: text("day_name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
});

export const rooms = sqliteTable("rooms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  capacity: integer("capacity").notNull(),
  supervisor: text("supervisor").notNull(),
  status: text("status").notNull(),
});

export const admissions = sqliteTable("admissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  registrationNo: text("registration_no").notNull().unique(),
  name: text("name").notNull(),
  applicantEmail: text("applicant_email").notNull().default(""),
  nisn: text("nisn").notNull().default(""),
  birthPlace: text("birth_place").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  gender: text("gender").notNull().default(""),
  desiredLevel: text("desired_level").notNull().default("SMP"),
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  previousSchool: text("previous_school").notNull(),
  address: text("address").notNull().default(""),
  status: text("status").notNull(),
  score: integer("score").notNull().default(0),
  verificationNote: text("verification_note").notNull().default(""),
  verifiedBy: text("verified_by").notNull().default(""),
  verifiedAt: text("verified_at").notNull().default(""),
  trackingToken: text("tracking_token").notNull().default("").unique(),
  createdAt: text("created_at").notNull(),
});

export const admissionDocuments = sqliteTable("admission_documents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  admissionId: integer("admission_id").notNull().references(() => admissions.id),
  docType: text("doc_type").notNull(),
  fileName: text("file_name").notNull(),
  objectKey: text("object_key").notNull().unique(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: text("status").notNull().default("Menunggu"),
  verificationNote: text("verification_note").notNull().default(""),
  verifiedBy: text("verified_by").notNull().default(""),
  verifiedAt: text("verified_at").notNull().default(""),
  uploadedAt: text("uploaded_at").notNull(),
});

export const counselingRecords = sqliteTable("counseling_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  type: text("type").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  points: integer("points").notNull().default(0),
  status: text("status").notNull(),
  counselor: text("counselor").notNull(),
  recordedAt: text("recorded_at").notNull(),
});

export const bills = sqliteTable("bills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  invoiceNo: text("invoice_no").notNull().unique(),
  category: text("category").notNull(),
  amount: integer("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull(),
  paymentUrl: text("payment_url").notNull(),
  paymentMethod: text("payment_method").notNull().default(""),
  paymentReference: text("payment_reference").notNull().default(""),
  paidAt: text("paid_at").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const guardianMessages = sqliteTable("guardian_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  senderEmail: text("sender_email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("Baru"),
  reply: text("reply").notNull().default(""),
  createdAt: text("created_at").notNull(),
  repliedAt: text("replied_at").notNull().default(""),
});

export const guardianRequests = sqliteTable("guardian_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  requesterEmail: text("requester_email").notNull(),
  type: text("type", { enum: ["Kunjungan", "Penjemputan"] }).notNull(),
  visitDate: text("visit_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  purpose: text("purpose").notNull(),
  visitorName: text("visitor_name").notNull(),
  visitorPhone: text("visitor_phone").notNull(),
  status: text("status").notNull().default("Diajukan"),
  qrToken: text("qr_token").notNull().unique(),
  usedAt: text("used_at").notNull().default(""),
  approvedBy: text("approved_by").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const walletAccounts = sqliteTable("wallet_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().unique().references(() => students.id),
  cardToken: text("card_token").notNull().unique(),
  balance: integer("balance").notNull().default(0),
  dailyLimit: integer("daily_limit").notNull().default(50000),
  status: text("status").notNull().default("Aktif"),
  updatedAt: text("updated_at").notNull(),
});

export const walletEntries = sqliteTable("wallet_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  entryType: text("entry_type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reference: text("reference").notNull(),
  note: text("note").notNull(),
  actorEmail: text("actor_email").notNull(),
  createdAt: text("created_at").notNull(),
});

export const walletTopups = sqliteTable("wallet_topups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topupNo: text("topup_no").notNull().unique(),
  studentId: integer("student_id").notNull().references(() => students.id),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("Menunggu Pembayaran"),
  paymentUrl: text("payment_url").notNull().default(""),
  paymentReference: text("payment_reference").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  paidAt: text("paid_at").notNull().default(""),
});

export const walletTopupSettlements = sqliteTable("wallet_topup_settlements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  topupId: integer("topup_id").notNull().unique().references(() => walletTopups.id),
  reference: text("reference").notNull(),
  createdAt: text("created_at").notNull(),
});

export const canteenProducts = sqliteTable("canteen_products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock").notNull(),
  status: text("status").notNull().default("Aktif"),
  updatedAt: text("updated_at").notNull(),
});

export const canteenSales = sqliteTable("canteen_sales", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  receiptNo: text("receipt_no").notNull().unique(),
  studentId: integer("student_id").notNull().references(() => students.id),
  total: integer("total").notNull(),
  status: text("status").notNull().default("Berhasil"),
  cashierEmail: text("cashier_email").notNull(),
  createdAt: text("created_at").notNull(),
  reversedAt: text("reversed_at").notNull().default(""),
});

export const canteenSaleItems = sqliteTable("canteen_sale_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  saleId: integer("sale_id").notNull().references(() => canteenSales.id),
  productId: integer("product_id").notNull().references(() => canteenProducts.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  subtotal: integer("subtotal").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  recordId: integer("record_id"),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeNo: text("employee_no").notNull().unique(),
  name: text("name").notNull(),
  gender: text("gender").notNull(),
  birthPlace: text("birth_place").notNull().default(""),
  birthDate: text("birth_date").notNull().default(""),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  position: text("position").notNull(),
  workUnit: text("work_unit").notNull(),
  employmentType: text("employment_type").notNull(),
  education: text("education").notNull().default(""),
  joinDate: text("join_date").notNull(),
  address: text("address").notNull().default(""),
  status: text("status").notNull().default("Aktif"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const schoolClasses = sqliteTable("school_classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  educationLevel: text("education_level", { enum: ["SMP", "SMK"] }).notNull(),
  gradeOrder: integer("grade_order").notNull(),
  major: text("major").notNull().default(""),
  homeroomTeacher: text("homeroom_teacher").notNull().default(""),
  capacity: integer("capacity").notNull().default(32),
  nextClassName: text("next_class_name").notNull().default(""),
  academicYear: text("academic_year").notNull(),
  status: text("status").notNull().default("Aktif"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const studentPromotions = sqliteTable("student_promotions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  studentName: text("student_name").notNull(),
  nis: text("nis").notNull(),
  fromClass: text("from_class").notNull(),
  toClass: text("to_class").notNull(),
  action: text("action", { enum: ["Naik Kelas", "Alumni"] }).notNull(),
  academicYearFrom: text("academic_year_from").notNull(),
  academicYearTo: text("academic_year_to").notNull(),
  processedBy: text("processed_by").notNull(),
  processedAt: text("processed_at").notNull(),
}, (table) => [
  uniqueIndex("student_promotions_year_idx").on(table.studentId, table.academicYearFrom),
  index("student_promotions_student_idx").on(table.studentId),
]);

export const guardianAccounts = sqliteTable("guardian_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  pinSalt: text("pin_salt").notNull(),
  status: text("status").notNull().default("Aktif"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const guardianSessions = sqliteTable("guardian_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id").notNull().references(() => guardianAccounts.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
});

export const guardianPinResets = sqliteTable("guardian_pin_resets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
