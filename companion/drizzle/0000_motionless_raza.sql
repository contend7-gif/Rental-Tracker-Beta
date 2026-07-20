CREATE TABLE `mobile_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`kind` text DEFAULT 'receipt' NOT NULL,
	`property_label` text,
	`unit_label` text,
	`note` text,
	`original_file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`storage_key` text NOT NULL,
	`captured_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`claimed_at` text,
	`imported_at` text
);
--> statement-breakpoint
CREATE INDEX `mobile_submissions_owner_status_created_idx` ON `mobile_submissions` (`owner_fingerprint`,`status`,`created_at`);