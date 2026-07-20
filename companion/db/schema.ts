import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const mobileSubmissions = sqliteTable("mobile_submissions", {
  id: text("id").primaryKey(),
  ownerFingerprint: text("owner_fingerprint").notNull(),
  status: text("status", { enum: ["pending", "claimed", "imported"] })
    .notNull()
    .default("pending"),
  kind: text("kind", { enum: ["receipt"] }).notNull().default("receipt"),
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
