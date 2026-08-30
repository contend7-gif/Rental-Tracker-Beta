import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mobileSubmissions = sqliteTable("mobile_submissions", {
  id: text("id").primaryKey(),
  ownerFingerprint: text("owner_fingerprint").notNull(),
  status: text("status", { enum: ["pending", "claimed", "imported"] })
    .notNull()
    .default("pending"),
  kind: text("kind", { enum: ["receipt", "maintenance"] }).notNull().default("receipt"),
  propertyLabel: text("property_label"),
  unitLabel: text("unit_label"),
  note: text("note"),
  originalFileName: text("original_file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: text("sha256").notNull(),
  storageKey: text("storage_key").notNull(),
  capturedAt: text("captured_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  claimedAt: text("claimed_at"),
  importedAt: text("imported_at"),
}, (table) => [
  index("mobile_submissions_owner_status_created_idx").on(
    table.ownerFingerprint,
    table.status,
    table.createdAt,
  ),
]);

export const companionPropertyCatalog = sqliteTable("companion_property_catalog", {
  propertyId: text("property_id").primaryKey(),
  label: text("label").notNull(),
  addressLabel: text("address_label").notNull().default(""),
  unitsJson: text("units_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const mobileMileageEntries = sqliteTable("mobile_mileage_entries", {
  id: text("id").primaryKey(),
  ownerFingerprint: text("owner_fingerprint").notNull(),
  status: text("status", { enum: ["pending", "claimed", "imported"] })
    .notNull()
    .default("pending"),
  propertyLabel: text("property_label").notNull(),
  unitLabel: text("unit_label"),
  tripDate: text("trip_date").notNull(),
  businessMiles: integer("business_miles_tenths").notNull(),
  purpose: text("purpose").notNull(),
  startLocation: text("start_location"),
  endLocation: text("end_location"),
  note: text("note"),
  capturedAt: text("captured_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  claimedAt: text("claimed_at"),
  importedAt: text("imported_at"),
}, (table) => [
  index("mobile_mileage_owner_status_created_idx").on(
    table.ownerFingerprint,
    table.status,
    table.createdAt,
  ),
]);
