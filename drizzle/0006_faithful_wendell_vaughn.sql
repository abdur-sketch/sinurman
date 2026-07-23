ALTER TABLE `admissions` ADD `tracking_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `admissions_tracking_token_unique` ON `admissions` (`tracking_token`) WHERE `tracking_token` <> '';--> statement-breakpoint
ALTER TABLE `users` ADD `room_scope` text DEFAULT '' NOT NULL;
