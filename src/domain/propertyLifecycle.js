export function activeProperties(properties = []) {
  return properties.filter((property) => !property?.archivedAt);
}

export function selectableProperties(properties = [], selectedPropertyId = "") {
  return properties.filter((property) => !property?.archivedAt || property.id === selectedPropertyId);
}
