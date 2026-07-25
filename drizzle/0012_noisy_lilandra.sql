CREATE TABLE `employees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`employee_no` text NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`birth_place` text DEFAULT '' NOT NULL,
	`birth_date` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`position` text NOT NULL,
	`work_unit` text NOT NULL,
	`employment_type` text NOT NULL,
	`education` text DEFAULT '' NOT NULL,
	`join_date` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_no_unique` ON `employees` (`employee_no`);