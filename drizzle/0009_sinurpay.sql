-- SINURPAY: buku tabungan santri dan kantin cashless
CREATE TABLE `canteen_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`price` integer NOT NULL,
	`stock` integer NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canteen_products_sku_unique` ON `canteen_products` (`sku`);--> statement-breakpoint
CREATE TABLE `canteen_sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`product_name` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `canteen_sales`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `canteen_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `canteen_sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`receipt_no` text NOT NULL,
	`student_id` integer NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'Berhasil' NOT NULL,
	`cashier_email` text NOT NULL,
	`created_at` text NOT NULL,
	`reversed_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `canteen_sales_receipt_no_unique` ON `canteen_sales` (`receipt_no`);--> statement-breakpoint
CREATE TABLE `wallet_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`card_token` text NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`daily_limit` integer DEFAULT 50000 NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_accounts_student_id_unique` ON `wallet_accounts` (`student_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_accounts_card_token_unique` ON `wallet_accounts` (`card_token`);--> statement-breakpoint
CREATE TABLE `wallet_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`entry_type` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`reference` text NOT NULL,
	`note` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
