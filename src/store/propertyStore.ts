import { normalizePropertyOperationNote, normalizePropertyOperationNotes, normalizePropertyValuation, normalizePropertyValuations } from "../features/properties/propertyOperations.js";
import { getPropertyCostBasis, type Asset, type Property, type PropertyOperationNote, type PropertyPhoto, type PropertyValuation, type Unit } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";

type StateSetter<T> = (updater: T[] | ((prev: T[]) => T[])) => void;

export function normalizeProperty(property: Property): Property {
  const purchasedOn = String(property.purchasedOn || "").trim();
  const ownerName = String(property.ownerName || "").trim();
  const ownerEmail = String(property.ownerEmail || "").trim();
  const ownerPhone = String(property.ownerPhone || "").trim();
  const purchasePrice = Number(property.purchasePrice);
  const landValue = Number(property.landValue);
  const currentValue = Number(property.currentValue);
  const archivedAt = String(property.archivedAt || "").trim();
  const photos = Array.isArray(property.photos)
    ? property.photos
        .filter((photo) => photo && String(photo.dataUrl || "").startsWith("data:image/"))
        .map((photo, index) => ({
          id: String(photo.id || `property-photo-${Date.now()}-${index}`),
          name: String(photo.name || `Property photo ${index + 1}`),
          dataUrl: String(photo.dataUrl || ""),
          uploadedAt: String(photo.uploadedAt || new Date().toISOString()),
          isCover: Boolean(photo.isCover),
          caption: String(photo.caption || "").trim() || undefined,
          category: String(photo.category || "").trim() || undefined,
          capturedOn: String(photo.capturedOn || "").trim() || undefined,
          unit: String(photo.unit || "").trim() || undefined,
        }))
    : [];
  if (photos.length > 0 && !photos.some((photo) => photo.isCover)) photos[0].isCover = true;
  let coverFound = false;
  photos.forEach((photo) => {
    if (!photo.isCover) return;
    if (coverFound) photo.isCover = false;
    coverFound = true;
  });

  return {
    ...property,
    id: String(property.id || `p${Date.now()}`).trim(),
    name: String(property.name || "").trim(),
    address: String(property.address || "").trim(),
    type: String(property.type || "").trim(),
    ownerName: ownerName || undefined,
    ownerEmail: ownerEmail || undefined,
    ownerPhone: ownerPhone || undefined,
    purchasedOn: purchasedOn || undefined,
    purchasePrice: Number.isFinite(purchasePrice) ? purchasePrice : undefined,
    landValue: Number.isFinite(landValue) ? landValue : undefined,
    currentValue: Number.isFinite(currentValue) ? currentValue : undefined,
    archivedAt: archivedAt || undefined,
    propertyValuations: normalizePropertyValuations(property.propertyValuations),
    operationNotes: normalizePropertyOperationNotes(property.operationNotes),
    photos,
  };
}

export function formatUsPhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";

  let working = digits;
  let country = "";
  if (working.length > 10 && working.startsWith("1")) {
    country = "1";
    working = working.slice(1);
  }
  if (working.length > 10) {
    working = working.slice(0, 10);
  }

  const area = working.slice(0, 3);
  const exchange = working.slice(3, 6);
  const line = working.slice(6, 10);

  let formatted = "";
  if (working.length <= 3) {
    formatted = area;
  } else if (working.length <= 6) {
    formatted = `(${area}) ${exchange}`;
  } else {
    formatted = `(${area}) ${exchange}-${line}`;
  }

  return country ? `+1 ${formatted}` : formatted;
}

export function createPropertyActions(args: {
  properties: Property[];
  setProperties: StateSetter<Property>;
  setUnits: StateSetter<Unit>;
  setAssets: StateSetter<Asset>;
  appendActivityLog: AppendActivityLog;
}) {
  const { properties, setProperties, setUnits, setAssets, appendActivityLog } = args;

  return {
    addPropertyWithUnits(input: { property: Omit<Property, "id">; unitNames: string[] }) {
      const propertyId = `p${Date.now()}`;
      const newProperty: Property = normalizeProperty({ id: propertyId, ...input.property });
      const newUnits: Unit[] = input.unitNames.map((name, idx) => ({
        id: `u${Date.now()}-${idx}`,
        propertyId,
        name,
        status: "Vacant",
      }));
      setProperties((prev) => [...prev, newProperty]);
      setUnits((prev) => [...prev, ...newUnits]);

      const costBasis = getPropertyCostBasis(newProperty);
      if (costBasis.ok) {
        setAssets((prev) => [
          {
            id: `a-${propertyId}-building`,
            propertyId,
            unit: "Shared",
            description: `${newProperty.name} Building`,
            type: "Residential Building",
            placedInService: costBasis.property.purchasedOn,
            cost: costBasis.purchasePrice,
            basis: costBasis.buildingBasis,
            life: 27.5,
            currentYearDep: costBasis.buildingBasis / 27.5,
            landValue: costBasis.landValue,
            bonusEligible: false,
            bonusElected: false,
            bonusRate: 0,
          },
          ...prev,
        ]);
      }

      appendActivityLog({
        action: "create",
        entityType: "property",
        entityId: newProperty.id,
        propertyId: newProperty.id,
        unit: "Shared",
        summary: "Property created.",
        details: newProperty.name,
      });
      return { property: newProperty, units: newUnits };
    },

    updatePropertyOwnerContact(propertyId: string, updates: Pick<Property, "ownerName" | "ownerEmail" | "ownerPhone">) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;

      const nextProperty = normalizeProperty({
        ...existingProperty,
        ownerName: updates.ownerName,
        ownerEmail: updates.ownerEmail,
        ownerPhone: updates.ownerPhone,
      });

      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "update",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Owner communication updated.",
        details: nextProperty.name,
      });
      return nextProperty;
    },

    updatePropertyValuation(propertyId: string, updates: Pick<Property, "currentValue">) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;

      const nextProperty = normalizeProperty({
        ...existingProperty,
        currentValue: updates.currentValue,
      });

      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "update",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Property value updated.",
        details: nextProperty.name,
      });
      return nextProperty;
    },

    updatePropertyDetails(propertyId: string, updates: Partial<Pick<Property, "name" | "address" | "type" | "purchasedOn" | "purchasePrice" | "landValue" | "currentValue">>) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;
      const nextProperty = normalizeProperty({ ...existingProperty, ...updates });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "update",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Property details updated.",
        details: nextProperty.name,
      });
      return nextProperty;
    },

    updatePropertyPhotos(propertyId: string, photos: PropertyPhoto[]) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;
      const nextProperty = normalizeProperty({ ...existingProperty, photos });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "update",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Property photos updated.",
        details: `${nextProperty.name} | ${nextProperty.photos?.length || 0} photos`,
      });
      return nextProperty;
    },

    archiveProperty(propertyId: string) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty || existingProperty.archivedAt) return null;
      const nextProperty = normalizeProperty({ ...existingProperty, archivedAt: new Date().toISOString() });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "archive",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Property archived.",
        details: nextProperty.name,
        category: "record",
      });
      return nextProperty;
    },

    restoreProperty(propertyId: string) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty?.archivedAt) return null;
      const nextProperty = normalizeProperty({ ...existingProperty, archivedAt: undefined });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "restore",
        entityType: "property",
        entityId: propertyId,
        propertyId,
        unit: "Shared",
        summary: "Property restored.",
        details: nextProperty.name,
        category: "record",
      });
      return nextProperty;
    },

    upsertPropertyValuation(propertyId: string, valuation: Partial<PropertyValuation>, options: { setCurrentValue?: boolean } = {}) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;

      const existingValuation = (existingProperty.propertyValuations || []).find((item) => item.id === valuation.id);
      const now = new Date().toISOString();
      const nextValuation = normalizePropertyValuation(
        {
          ...existingValuation,
          ...valuation,
          createdAt: existingValuation?.createdAt || valuation.createdAt || now,
          updatedAt: now,
        },
        { now },
      );
      if (Number(nextValuation.value || 0) <= 0) return null;

      const nextValuations = normalizePropertyValuations([
        nextValuation,
        ...(existingProperty.propertyValuations || []).filter((item) => item.id !== nextValuation.id),
      ]);
      const nextProperty = normalizeProperty({
        ...existingProperty,
        currentValue: options.setCurrentValue ? nextValuation.value : existingProperty.currentValue,
        propertyValuations: nextValuations,
      });

      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: existingValuation ? "update" : "create",
        entityType: "property-valuation",
        entityId: nextValuation.id,
        propertyId,
        unit: "Shared",
        summary: existingValuation ? "Property valuation updated." : "Property valuation added.",
        details: `${nextProperty.name} | ${nextValuation.source} | ${nextValuation.date} | ${nextValuation.value}`,
        category: "record",
      });
      return nextValuation;
    },

    deletePropertyValuation(propertyId: string, valuationId: string) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;
      const existingValuation = (existingProperty.propertyValuations || []).find((valuation) => valuation.id === valuationId);
      if (!existingValuation) return null;

      const nextProperty = normalizeProperty({
        ...existingProperty,
        propertyValuations: (existingProperty.propertyValuations || []).filter((valuation) => valuation.id !== valuationId),
      });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "delete",
        entityType: "property-valuation",
        entityId: valuationId,
        propertyId,
        unit: "Shared",
        summary: "Property valuation deleted.",
        details: `${existingProperty.name} | ${existingValuation.source} | ${existingValuation.date}`,
        category: "record",
      });
      return existingValuation;
    },

    upsertPropertyOperationNote(propertyId: string, note: Partial<PropertyOperationNote>) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;

      const existingNote = (existingProperty.operationNotes || []).find((item) => item.id === note.id);
      const now = new Date().toISOString();
      const nextNote = normalizePropertyOperationNote(
        {
          ...existingNote,
          ...note,
          createdAt: existingNote?.createdAt || note.createdAt || now,
          updatedAt: now,
        },
        { now },
      );

      const nextNotes = normalizePropertyOperationNotes([
        nextNote,
        ...(existingProperty.operationNotes || []).filter((item) => item.id !== nextNote.id),
      ]);
      const nextProperty = normalizeProperty({ ...existingProperty, operationNotes: nextNotes });

      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: existingNote ? "update" : "create",
        entityType: "property-operation-note",
        entityId: nextNote.id,
        propertyId,
        unit: nextNote.unit,
        summary: existingNote ? "Property operations note updated." : "Property operations note created.",
        details: nextNote.sensitive ? `${nextNote.title} (sensitive)` : nextNote.title,
        category: "record",
      });
      return nextNote;
    },

    deletePropertyOperationNote(propertyId: string, noteId: string) {
      const existingProperty = properties.find((property) => property.id === propertyId);
      if (!existingProperty) return null;
      const existingNote = (existingProperty.operationNotes || []).find((note) => note.id === noteId);
      if (!existingNote) return null;

      const nextProperty = normalizeProperty({
        ...existingProperty,
        operationNotes: (existingProperty.operationNotes || []).filter((note) => note.id !== noteId),
      });
      setProperties((prev) => prev.map((property) => (property.id === propertyId ? nextProperty : property)));
      appendActivityLog({
        action: "delete",
        entityType: "property-operation-note",
        entityId: noteId,
        propertyId,
        unit: existingNote.unit,
        summary: "Property operations note deleted.",
        details: existingNote.sensitive ? `${existingNote.title} (sensitive)` : existingNote.title,
        category: "record",
      });
      return existingNote;
    },
  };
}
