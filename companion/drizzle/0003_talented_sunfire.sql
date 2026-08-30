CREATE TABLE `mobile_upload_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_fingerprint` text NOT NULL,
	`kind` text DEFAULT 'receipt' NOT NULL,
	`property_label` text,
	`unit_label` text,
	`note` text,
	`original_file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`chunk_count` integer NOT NULL,
	`sha256` text NOT NULL,
	`captured_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mobile_upload_sessions_owner_created_idx` ON `mobile_upload_sessions` (`owner_fingerprint`,`created_at`);