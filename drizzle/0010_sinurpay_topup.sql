-- SINURPAY: top-up wali melalui QRIS dan transfer bank
CREATE TABLE `wallet_topups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topup_no` text NOT NULL,
	`student_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`method` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'Menunggu Pembayaran' NOT NULL,
	`payment_url` text DEFAULT '' NOT NULL,
	`payment_reference` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`paid_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_topups_topup_no_unique` ON `wallet_topups` (`topup_no`);
