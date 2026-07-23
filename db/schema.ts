import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role", { enum: ["Admin", "Ustadz", "Wali Santri"] }).notNull(),
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
  amount: integer("amount").notNull(),
  grade: text("grade").notNull(),
  teacher: text("teacher").notNull(),
  recordedAt: text("recorded_at").notNull(),
});

export const mutabaahRecords = sqliteTable("mutabaah_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  activity: text("activity").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  recordDate: text("record_date").notNull(),
  recordedBy: text("recorded_by").notNull(),
});

export const healthRecords = sqliteTable("health_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  studentId: integer("student_id").notNull().references(() => students.id),
  complaint: text("complaint").notNull(),
  diagnosis: text("diagnosis").notNull(),
  treatment: text("treatment").notNull(),
  status: text("status").notNull(),
  recordedAt: text("recorded_at").notNull(),
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
  guardianName: text("guardian_name").notNull(),
  guardianPhone: text("guardian_phone").notNull(),
  previousSchool: text("previous_school").notNull(),
  status: text("status").notNull(),
  score: integer("score").notNull().default(0),
  createdAt: text("created_at").notNull(),
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

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  recordId: integer("record_id"),
  detail: text("detail").notNull(),
  createdAt: text("created_at").notNull(),
});
