import { useEffect, useState } from "react";

export function usePropertyOwnerContactController({
  actions,
  properties,
  requirePermission,
  setNotice,
}) {
  const [propertyOwnerDrafts, setPropertyOwnerDrafts] = useState({});

  useEffect(() => {
    setPropertyOwnerDrafts((prev) => {
      const next = {};
      let changed = false;
      properties.forEach((property) => {
        if (prev[property.id]) {
          next[property.id] = prev[property.id];
          return;
        }
        changed = true;
        next[property.id] = {
          ownerName: property.ownerName || "",
          ownerEmail: property.ownerEmail || "",
          ownerPhone: property.ownerPhone || "",
        };
      });
      if (!changed && Object.keys(prev).length === properties.length) {
        return prev;
      }
      return next;
    });
  }, [properties]);

  const savePropertyOwnerContact = (property) => {
    if (!requirePermission("create_edit_records", "This access profile cannot update owner contacts.")) return;
    const draft = propertyOwnerDrafts[property.id] || {
      ownerName: property.ownerName || "",
      ownerEmail: property.ownerEmail || "",
      ownerPhone: property.ownerPhone || "",
    };
    const hasChanges = (
      String(draft.ownerName || "").trim() !== String(property.ownerName || "").trim() ||
      String(draft.ownerEmail || "").trim() !== String(property.ownerEmail || "").trim() ||
      String(draft.ownerPhone || "").trim() !== String(property.ownerPhone || "").trim()
    );
    if (!hasChanges) {
      setNotice("Owner contact is already up to date.");
      return;
    }

    const updatedProperty = actions.updatePropertyOwnerContact?.(property.id, {
      ownerName: String(draft.ownerName || "").trim(),
      ownerEmail: String(draft.ownerEmail || "").trim(),
      ownerPhone: String(draft.ownerPhone || "").trim(),
    });
    if (!updatedProperty) {
      setNotice("Could not save the owner contact.");
      return;
    }

    setPropertyOwnerDrafts((prev) => ({
      ...prev,
      [property.id]: {
        ownerName: updatedProperty.ownerName || "",
        ownerEmail: updatedProperty.ownerEmail || "",
        ownerPhone: updatedProperty.ownerPhone || "",
      },
    }));
    setNotice(`Owner contact saved for ${updatedProperty.name}.`);
  };

  return {
    propertyOwnerDrafts,
    savePropertyOwnerContact,
    setPropertyOwnerDrafts,
  };
}
