CREATE TABLE `lease_turnovers` (
	`lease_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL,
	`desktop_base` text NOT NULL,
	`desktop_generated_at` text NOT NULL,
	`conflict` text,
	`updated_at` text NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE TABLE `turnover_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`lease_id` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `turnover_photos_lease_idx` ON `turnover_photos` (`lease_id`);