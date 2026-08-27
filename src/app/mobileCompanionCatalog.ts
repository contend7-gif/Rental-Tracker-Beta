import type { Property, Unit } from "../models.ts";

export type MobileCompanionCatalogUnit = {
  id: string;
  label: string;
};

export type MobileCompanionCatalogProperty = {
  id: string;
  label: string;
  addressLabel: string;
  units: MobileCompanionCatalogUnit[];
};

export type MobileCompanionCatalog = {
  version: 1;
  properties: MobileCompanionCatalogProperty[];
};

export function buildMobileCompanionCatalog({
  properties = [],
  units = [],
}: {
  properties?: Property[];
  units?: Unit[];
} = {}): MobileCompanionCatalog {
  const activeProperties = properties
    .filter((property) => !property.archivedAt)
    .map((property) => {
      const id = cleanText(property.id, 120);
      const name = cleanText(property.name, 120);
      const address = cleanText(property.address, 180);
      const label = name || address;
      return {
        id,
        label,
        addressLabel: address && address !== label ? address : "",
      };
    })
    .filter((property) => property.id && property.label)
    .slice(0, 100);

  return {
    version: 1,
    properties: activeProperties.map((property) => ({
      id: property.id,
      label: property.label,
      addressLabel: property.addressLabel,
      units: units
        .filter((unit) => unit.propertyId === property.id)
        .map((unit) => ({
          id: cleanText(unit.id, 120),
          label: cleanText(unit.name, 80),
        }))
        .filter((unit) => unit.id && unit.label)
        .slice(0, 100),
    })),
  };
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}
