import { env } from "cloudflare:workers";

export type PropertyCatalogUnit = {
  id: string;
  label: string;
};

export type PropertyCatalogItem = {
  id: string;
  label: string;
  addressLabel: string;
  units: PropertyCatalogUnit[];
};

export type PropertyCatalog = {
  version: 1;
  properties: PropertyCatalogItem[];
  updatedAt: string | null;
};

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS companion_property_catalog (
  property_id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  address_label TEXT NOT NULL DEFAULT '',
  units_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
)`;

let schemaPromise: Promise<void> | null = null;

function database(): D1Database {
  const bound = env as unknown as { DB?: D1Database };
  if (!bound.DB) throw new Error("Companion database binding is unavailable.");
  return bound.DB;
}

export function normalizePropertyCatalog(value: unknown): Omit<PropertyCatalog, "updatedAt"> {
  const source = isRecord(value) && Array.isArray(value.properties) ? value.properties : [];
  const properties: PropertyCatalogItem[] = [];
  const propertyIds = new Set<string>();

  for (const rawProperty of source.slice(0, 100)) {
    if (!isRecord(rawProperty)) continue;
    const id = cleanText(rawProperty.id, 120);
    const label = cleanText(rawProperty.label, 120);
    if (!id || !label || propertyIds.has(id)) continue;
    propertyIds.add(id);

    const units: PropertyCatalogUnit[] = [];
    const unitIds = new Set<string>();
    const rawUnits = Array.isArray(rawProperty.units) ? rawProperty.units : [];
    for (const rawUnit of rawUnits.slice(0, 100)) {
      if (!isRecord(rawUnit)) continue;
      const unitId = cleanText(rawUnit.id, 120);
      const unitLabel = cleanText(rawUnit.label, 80);
      if (!unitId || !unitLabel || unitIds.has(unitId)) continue;
      unitIds.add(unitId);
      units.push({ id: unitId, label: unitLabel });
    }

    properties.push({
      id,
      label,
      addressLabel: cleanText(rawProperty.addressLabel, 180),
      units,
    });
  }

  return { version: 1, properties };
}

export async function replacePropertyCatalog(value: unknown): Promise<PropertyCatalog> {
  await ensureSchema();
  const catalog = normalizePropertyCatalog(value);
  const DB = database();
  const updatedAt = new Date().toISOString();
  const statements = [DB.prepare("DELETE FROM companion_property_catalog")];
  catalog.properties.forEach((property, sortOrder) => {
    statements.push(DB.prepare(`
      INSERT INTO companion_property_catalog (
        property_id, label, address_label, units_json, sort_order, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      property.id,
      property.label,
      property.addressLabel,
      JSON.stringify(property.units),
      sortOrder,
      updatedAt,
    ));
  });
  await DB.batch(statements);
  return { ...catalog, updatedAt };
}

export async function listPropertyCatalog(): Promise<PropertyCatalog> {
  await ensureSchema();
  const result = await database().prepare(`
    SELECT property_id, label, address_label, units_json, updated_at
    FROM companion_property_catalog
    ORDER BY sort_order ASC, label ASC
  `).all<Record<string, unknown>>();
  const properties = result.results.map((row) => ({
    id: String(row.property_id),
    label: String(row.label),
    addressLabel: String(row.address_label || ""),
    units: parseUnits(row.units_json),
  }));
  return {
    version: 1,
    properties,
    updatedAt: properties.length > 0 ? String(result.results[0]?.updated_at || "") || null : null,
  };
}

async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = database().prepare(CREATE_TABLE_SQL).run().then(() => undefined).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

function parseUnits(value: unknown): PropertyCatalogUnit[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed)
      ? parsed.filter((unit): unit is PropertyCatalogUnit => isRecord(unit) && typeof unit.id === "string" && typeof unit.label === "string")
      : [];
  } catch {
    return [];
  }
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
