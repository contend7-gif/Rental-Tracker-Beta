type SearchSource = { id: string; [key: string]: unknown };
export type SearchResult = { key: string; kind: string; id: string; title: string; detail: string; searchText: string };

function normalize(value: unknown) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function buildGlobalSearchIndex(collections: Record<string, SearchSource[]>, propertyNames: Record<string, string> = {}): SearchResult[] {
  const results: SearchResult[] = [];
  for (const [kind, records] of Object.entries(collections)) {
    for (const record of records) {
      if (kind === "transaction" && record.status !== "active") continue;
      const title = String(record.tenantName || record.name || record.title || record.description || record.id);
      const detail = [propertyNames[String(record.propertyId || "")], record.unit, record.date || record.startDate, record.vendor, record.amount].filter((item) => item !== undefined && item !== "").join(" · ");
      // Index only searchable record fields; never include document bytes or settings/secrets.
      const fields = [title, detail, record.description, record.address, record.id, record.invoiceRef, record.tags, record.extractedText];
      results.push({ key: `${kind}:${record.id}`, kind, id: record.id, title, detail, searchText: normalize(fields.join(" ")) });
    }
  }
  return results;
}

export function searchGlobalRecords(index: SearchResult[], query: string, limit = 50): SearchResult[] {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return index.filter((item) => item.kind === "navigation" || item.kind === "action").slice(0, limit);
  const matches = index.filter((item) => terms.every((term) => item.searchText.includes(term)));
  matches.sort((left, right) => Number(normalize(right.title).startsWith(terms[0])) - Number(normalize(left.title).startsWith(terms[0])));
  return matches.slice(0, limit);
}
