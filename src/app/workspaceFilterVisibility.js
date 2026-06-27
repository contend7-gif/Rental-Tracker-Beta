export const WORKSPACE_FILTER_VISIBILITY = {
  dashboard: { year: true, property: true, unit: true },
  ledger: { year: true, property: true, unit: true },
  review: { year: true, property: true, unit: true },
  leaseHistory: { year: true, property: true, unit: true },
  tax: { year: true, property: true, unit: true },
  activity: { year: true, property: true, unit: true },
  documents: { property: true, unit: true },
  maintenance: { property: true, unit: true },
  assets: { year: true, property: true },
  properties: { property: true },
  loans: { year: true, property: true },
  planning: { property: true },
};

export function getWorkspaceFilterVisibility(view) {
  return WORKSPACE_FILTER_VISIBILITY[view] || null;
}
