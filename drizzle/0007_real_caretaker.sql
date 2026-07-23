ALTER TABLE `tahfidz_records` ADD `surah_from` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tahfidz_records` ADD `surah_to` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `tahfidz_records` ADD `verse_from` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tahfidz_records` ADD `verse_to` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `tahfidz_records` SET `surah_from`=`surah`, `surah_to`=`surah`;--> statement-breakpoint
UPDATE `tahfidz_records`
SET `verse_from`=CASE
  WHEN instr(replace(`verses`,'–','-'),'-')>0 THEN CAST(substr(replace(`verses`,'–','-'),1,instr(replace(`verses`,'–','-'),'-')-1) AS INTEGER)
  ELSE CAST(`verses` AS INTEGER)
END,
`verse_to`=CASE
  WHEN instr(replace(`verses`,'–','-'),'-')>0 THEN CAST(substr(replace(`verses`,'–','-'),instr(replace(`verses`,'–','-'),'-')+1) AS INTEGER)
  ELSE CAST(`verses` AS INTEGER)
END;
