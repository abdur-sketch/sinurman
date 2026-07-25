CREATE TABLE `guardian_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`phone` text NOT NULL,
	`pin_hash` text NOT NULL,
	`pin_salt` text NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_accounts_phone_unique` ON `guardian_accounts` (`phone`);--> statement-breakpoint
CREATE TABLE `guardian_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `guardian_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_sessions_token_hash_unique` ON `guardian_sessions` (`token_hash`);