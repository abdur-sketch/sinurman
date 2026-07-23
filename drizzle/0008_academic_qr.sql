CREATE TABLE `academic_subjects` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `code` text NOT NULL,
  `name` text NOT NULL,
  `education_level` text NOT NULL,
  `class_name` text NOT NULL,
  `teacher` text NOT NULL,
  `semester` text NOT NULL,
  `academic_year` text NOT NULL,
  `minimum_score` integer DEFAULT 75 NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_subjects_code_unique` ON `academic_subjects` (`code`);
--> statement-breakpoint
CREATE TABLE `academic_grades` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `student_id` integer NOT NULL,
  `subject_id` integer NOT NULL,
  `assignment_score` integer NOT NULL,
  `midterm_score` integer NOT NULL,
  `exam_score` integer NOT NULL,
  `final_score` integer NOT NULL,
  `predicate` text NOT NULL,
  `note` text NOT NULL,
  `semester` text NOT NULL,
  `academic_year` text NOT NULL,
  `recorded_by` text NOT NULL,
  `recorded_at` text NOT NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`subject_id`) REFERENCES `academic_subjects`(`id`) ON UPDATE no action ON DELETE no action
);
