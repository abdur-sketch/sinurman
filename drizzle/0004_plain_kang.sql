CREATE TABLE `guardian_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`requester_email` text NOT NULL,
	`type` text NOT NULL,
	`visit_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`purpose` text NOT NULL,
	`visitor_name` text NOT NULL,
	`visitor_phone` text NOT NULL,
	`status` text DEFAULT 'Diajukan' NOT NULL,
	`qr_token` text NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_requests_qr_token_unique` ON `guardian_requests` (`qr_token`);--> statement-breakpoint
ALTER TABLE `bills` ADD `payment_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `payment_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `paid_at` text DEFAULT '' NOT NULL;