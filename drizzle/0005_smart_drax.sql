CREATE TABLE `admission_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`admission_id` integer NOT NULL,
	`doc_type` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`status` text DEFAULT 'Menunggu' NOT NULL,
	`verification_note` text DEFAULT '' NOT NULL,
	`verified_by` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL,
	`uploaded_at` text NOT NULL,
	FOREIGN KEY (`admission_id`) REFERENCES `admissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admission_documents_object_key_unique` ON `admission_documents` (`object_key`);--> statement-breakpoint
ALTER TABLE `admissions` ADD `applicant_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `nisn` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `birth_place` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `birth_date` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `gender` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `desired_level` text DEFAULT 'SMP' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `verification_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `verified_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `admissions` ADD `verified_at` text DEFAULT '' NOT NULL;