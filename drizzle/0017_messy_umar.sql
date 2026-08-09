CREATE TABLE `tahsin_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`level` text NOT NULL,
	`makhraj_score` integer NOT NULL,
	`tajwid_score` integer NOT NULL,
	`fluency_score` integer NOT NULL,
	`length_score` integer NOT NULL,
	`adab_score` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`teacher` text NOT NULL,
	`recorded_at` text NOT NULL,
	`workflow_status` text DEFAULT 'Dipublikasikan' NOT NULL,
	`period_key` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tahsin_student_period_idx` ON `tahsin_records` (`student_id`,`period_key`,`workflow_status`);