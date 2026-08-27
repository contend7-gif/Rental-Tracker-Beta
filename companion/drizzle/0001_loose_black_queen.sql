CREATE TABLE `companion_property_catalog` (
	`property_id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`address_label` text DEFAULT '' NOT NULL,
	`units_json` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
