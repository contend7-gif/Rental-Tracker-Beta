import { createBlankDocumentImportDraft } from "./draftFactories.js";
import { parseDocumentTags } from "./documentShared.ts";

export type DocumentImportDraft = ReturnType<typeof createBlankDocumentImportDraft>;

export type DocumentImportContext = Partial<Pick<
  DocumentImportDraft,
  "propertyId" | "unit" | "type" | "tags" | "linkType" | "linkedId"
>>;

type DocumentImportScope = {
  propertyFilter: string;
  unitFilter: string;
  defaultPropertyId: string;
};

export function hasDocumentImportContext(context?: DocumentImportContext | null): boolean {
  return Boolean(context && Object.keys(context).length > 0);
}

export function buildDocumentImportPickerDraft(
  previous: DocumentImportDraft | null,
  context: DocumentImportContext = {},
  scope: DocumentImportScope,
): DocumentImportDraft {
  const defaultPropertyId = scope.propertyFilter !== "all" ? scope.propertyFilter : scope.defaultPropertyId;
  const defaultUnit = scope.unitFilter !== "all" ? scope.unitFilter : "Shared";
  if (!previous || !hasDocumentImportContext(context)) {
    return createBlankDocumentImportDraft(defaultPropertyId, defaultUnit);
  }

  const base = createBlankDocumentImportDraft(
    context.propertyId || previous.propertyId || defaultPropertyId,
    context.unit || previous.unit || defaultUnit,
  );
  const tags = Array.from(new Set([
    ...parseDocumentTags(previous.tags),
    ...parseDocumentTags(context.tags || ""),
  ]));
  return {
    ...base,
    ...previous,
    propertyId: context.propertyId || previous.propertyId || base.propertyId,
    unit: context.unit || previous.unit || base.unit,
    type: context.type || previous.type || base.type,
    tags: tags.join(", "),
    linkType: context.linkType || previous.linkType || "none",
    linkedId: context.linkedId || previous.linkedId || "",
  };
}
