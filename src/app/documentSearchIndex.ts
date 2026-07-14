export type DocumentSearchIndex = Record<string, string>;

export function buildDocumentSearchIndex<T extends { id: string }>(
  documents: T[],
  getSearchParts: (document: T) => unknown[],
): DocumentSearchIndex {
  return Object.fromEntries(documents.map((document) => [
    document.id,
    getSearchParts(document).map((part) => String(part || "")).join(" ").toLowerCase(),
  ]));
}

export function matchesDocumentSearch(index: DocumentSearchIndex, documentId: string, query: string): boolean {
  return !query || Boolean(index[documentId]?.includes(query));
}
