export function usePropertyQuickAddController({
  actions,
  propertyDraft,
  requirePermission,
  resetPropertyDraft,
  setAssetDraft,
  setNotice,
  setPropertyFilter,
  setPropertyQuickAddOpen,
  setView,
}) {
  const saveProperty = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save properties.")) return;
    const unitNames = propertyDraft.unitsText
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (!propertyDraft.name.trim() || !propertyDraft.address.trim() || unitNames.length === 0) {
      setNotice("Property name, address, and at least one unit are required.");
      return;
    }

    const result = actions.addPropertyWithUnits({
      property: {
        name: propertyDraft.name.trim(),
        address: propertyDraft.address.trim(),
        type: propertyDraft.type,
        ownerName: propertyDraft.ownerName.trim(),
        ownerEmail: propertyDraft.ownerEmail.trim(),
        ownerPhone: propertyDraft.ownerPhone.trim(),
        purchasedOn: propertyDraft.purchasedOn,
        purchasePrice: propertyDraft.purchasePrice ? Number(propertyDraft.purchasePrice) : undefined,
        landValue: propertyDraft.landValue ? Number(propertyDraft.landValue) : undefined,
        currentValue: propertyDraft.currentValue ? Number(propertyDraft.currentValue) : undefined,
      },
      unitNames,
    });

    setNotice("Added property " + result.property.name + " with " + result.units.length + " units.");
    setPropertyFilter(result.property.id);
    setAssetDraft((prev) => ({ ...prev, propertyId: result.property.id }));
    setView("properties");
    setPropertyQuickAddOpen(false);
    resetPropertyDraft();
  };

  return { saveProperty };
}
