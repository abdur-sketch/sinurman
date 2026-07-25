CREATE TABLE `school_classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`education_level` text NOT NULL,
	`grade_order` integer NOT NULL,
	`major` text DEFAULT '' NOT NULL,
	`homeroom_teacher` text DEFAULT '' NOT NULL,
	`capacity` integer DEFAULT 32 NOT NULL,
	`next_class_name` text DEFAULT '' NOT NULL,
	`academic_year` text NOT NULL,
	`status` text DEFAULT 'Aktif' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_classes_name_unique` ON `school_classes` (`name`);--> statement-breakpoint
CREATE TABLE `student_promotions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`student_name` text NOT NULL,
	`nis` text NOT NULL,
	`from_class` text NOT NULL,
	`to_class` text NOT NULL,
	`action` text NOT NULL,
	`academic_year_from` text NOT NULL,
	`academic_year_to` text NOT NULL,
	`processed_by` text NOT NULL,
	`processed_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
