CREATE TABLE `guardian_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`sender_email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'Baru' NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`replied_at` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `students` ADD `guardian_email` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `students` SET `guardian_email` = CASE `nis`
	WHEN 'SN-240181' THEN 'wali.fikri@sinurman.id'
	WHEN 'SN-240182' THEN 'wali.fauzan@sinurman.id'
	WHEN 'SN-240194' THEN 'wali.rizky@sinurman.id'
	WHEN 'SN-240207' THEN 'wali.nabil@sinurman.id'
	WHEN 'SN-240212' THEN 'wali.faris@sinurman.id'
	ELSE `guardian_email`
END
WHERE `guardian_email` = '';
