import { useEffect, useMemo } from "react";
import { leaseIsActiveByDate } from "./leaseShared.js";
import { rentAmountForLeasePayment } from "../domain/rentProration.js";

const MID_TERM_EXTRA_INCOME_CATEGORIES = ["Pet fees", "Cleaning fees"];
const MID_TERM_CLEANING_FEE_DEFAULT = 200;

export function useTransactionFormSuggestions({
  categories,
  form,
  leases,
  properties,
  rentAmountTouched,
  setForm,
  setRentAmountTouched,
  units,
}) {
  useEffect(() => {
    const firstPropertyId = properties[0]?.id || "";
    const propertyExists = form.propertyId && properties.some((property) => property.id === form.propertyId);

    if (!propertyExists) {
      if (form.propertyId !== firstPropertyId) {
        setForm((prev) => ({ ...prev, propertyId: firstPropertyId, unit: "Shared" }));
      }
      return;
    }

    const validUnits = new Set(["Shared", ...units.filter((unit) => unit.propertyId === form.propertyId).map((unit) => unit.name)]);
    if (!validUnits.has(form.unit)) {
      setForm((prev) => ({ ...prev, unit: "Shared" }));
    }
  }, [form.propertyId, form.unit, properties, setForm, units]);

  const rentLeaseForForm = useMemo(
    () => {
      const explicitLease = String(form.rentLeaseId || "").trim()
        ? leases.find(
            (lease) =>
              lease.id === String(form.rentLeaseId || "").trim() &&
              lease.propertyId === form.propertyId &&
              lease.unit === form.unit,
          )
        : null;
      return explicitLease || leases.find(
        (lease) =>
          lease.propertyId === form.propertyId &&
          lease.unit === form.unit &&
          leaseIsActiveByDate(lease, form.date),
      ) || null;
    },
    [leases, form.propertyId, form.unit, form.date, form.rentLeaseId],
  );

  const midTermLeaseForForm = useMemo(() => {
    if (!rentLeaseForForm) return null;
    return rentLeaseForForm.rentalType === "Mid-term" ? rentLeaseForForm : null;
  }, [rentLeaseForForm]);

  const incomeCategoriesForForm = useMemo(() => {
    const baseIncome = [...categories.Income];
    return Array.from(new Set([baseIncome[0], ...MID_TERM_EXTRA_INCOME_CATEGORIES, ...baseIncome.slice(1)]));
  }, [categories.Income]);

  const categoriesForFormType = useMemo(() => {
    if (form.type === "Income") return incomeCategoriesForForm;
    return categories[form.type] || [];
  }, [categories, form.type, incomeCategoriesForForm]);

  useEffect(() => {
    if (!categoriesForFormType.includes(form.category)) {
      setForm((prev) => ({ ...prev, category: categoriesForFormType[0] || "Other income" }));
    }
  }, [categoriesForFormType, form.category, setForm]);

  useEffect(() => {
    if (form.type !== "Income" || form.category !== "Rents received" || form.rentPeriod || !form.date) return;
    setForm((prev) => ({ ...prev, rentPeriod: prev.rentPeriod || prev.date.slice(0, 7) }));
  }, [form.category, form.date, form.rentPeriod, form.type, setForm]);

  const suggestedAmount = useMemo(() => {
    if (form.type !== "Income" || !form.date) return null;
    if (form.category === "Rents received") {
      if (!rentLeaseForForm) return null;
      return rentAmountForLeasePayment(rentLeaseForForm, form.rentPeriod ? `${form.rentPeriod}-01` : form.date);
    }
    if (form.category === "Cleaning fees" && midTermLeaseForForm) {
      return MID_TERM_CLEANING_FEE_DEFAULT;
    }
    return null;
  }, [form.type, form.category, form.date, form.rentPeriod, rentLeaseForForm, midTermLeaseForForm]);

  useEffect(() => {
    setRentAmountTouched(false);
  }, [form.type, form.category, form.propertyId, form.unit, form.date, form.rentLeaseId, form.rentPeriod, setRentAmountTouched]);

  useEffect(() => {
    if (rentAmountTouched || suggestedAmount == null) return;
    const suggested = String(suggestedAmount);
    if (form.amount !== suggested) {
      setForm((prev) => ({ ...prev, amount: suggested }));
    }
  }, [suggestedAmount, rentAmountTouched, form.amount, setForm]);

  return {
    categoriesForFormType,
    incomeCategoriesForForm,
  };
}
