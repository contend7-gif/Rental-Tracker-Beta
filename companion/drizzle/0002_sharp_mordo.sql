CREATE TABLE `mobile_mileage_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`property_label` text NOT NULL,
	`unit_label` text,
	`trip_date` text NOT NULL,
	`business_miles_tenths` integer NOT NULL,
	`purpose` text NOT NULL,
	`start_location` text,
	`end_location` text,
	`note` text,
	`captured_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`claimed_at` text,
	`imported_at` text
);
--> statement-breakpoint
CREATE INDEX `mobile_mileage_owner_status_created_idx` ON `mobile_mileage_entries` (`owner_fingerprint`,`status`,`created_at`);