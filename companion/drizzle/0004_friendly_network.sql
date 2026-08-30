CREATE TABLE `companion_retention_preferences` (
	`owner_fingerprint` text PRIMARY KEY NOT NULL,
	`retention_days` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mobile_submission_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`sha256` text NOT NULL,
	`captured_at` text NOT NULL,
	`imported_at` text NOT NULL,
	`cloud_deleted_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `mobile_submission_receipts_owner_deleted_idx` ON `mobile_submission_receipts` (`owner_fingerprint`,`cloud_deleted_at`);