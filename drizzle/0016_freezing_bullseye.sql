CREATE TABLE `academic_periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_key` text NOT NULL,
	`academic_year` text NOT NULL,
	`semester` text NOT NULL,
	`status` text DEFAULT 'Terbuka' NOT NULL,
	`locked_by` text DEFAULT '' NOT NULL,
	`locked_at` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `academic_periods_period_key_unique` ON `academic_periods` (`period_key`);--> statement-breakpoint
ALTER TABLE `academic_grades` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `academic_grades` ADD `period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendance_records` ADD `period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `character_reports` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `character_reports` ADD `period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `health_records` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `health_records` ADD `period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `mutabaah_records` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `mutabaah_records` ADD `period_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tahfidz_records` ADD `workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL;--> statement-breakpoint
ALTER TABLE `tahfidz_records` ADD `period_key` text DEFAULT '' NOT NULL;