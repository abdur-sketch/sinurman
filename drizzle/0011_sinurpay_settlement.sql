-- Idempotency guard: one settlement can credit a top-up only once
CREATE TABLE `wallet_topup_settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`topup_id` integer NOT NULL,
	`reference` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`topup_id`) REFERENCES `wallet_topups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_topup_settlements_topup_id_unique` ON `wallet_topup_settlements` (`topup_id`);
