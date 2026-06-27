export function clampPercentInput(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function formatPercentInput(value) {
  const clamped = clampPercentInput(value);
  if (Math.abs(clamped - Math.round(clamped)) < 0.001) return String(Math.round(clamped));
  return clamped.toFixed(2).replace(/\.?0+$/, "");
}

export function normalizeCatalogName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function commonPrefixLength(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  const max = Math.min(a.length, b.length);
  let count = 0;
  while (count < max && a[count] === b[count]) count += 1;
  return count;
}

export function namesLikelyReferToSamePerson(left, right) {
  const normalizedLeft = normalizeCatalogName(left);
  const normalizedRight = normalizeCatalogName(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;

  const leftParts = normalizedLeft.split(" ");
  const rightParts = normalizedRight.split(" ");
  const leftFirst = leftParts[0] || "";
  const rightFirst = rightParts[0] || "";
  const leftLast = leftParts[leftParts.length - 1] || "";
  const rightLast = rightParts[rightParts.length - 1] || "";

  if (!leftFirst || !rightFirst || !leftLast || !rightLast) return false;
  return commonPrefixLength(leftFirst, rightFirst) >= 4 && commonPrefixLength(leftLast, rightLast) >= 4;
}

export function scoreVendorForMaintenance(vendor, linkedWorkOrderCount = 0) {
  return (
    (linkedWorkOrderCount > 0 ? 100 : 0) +
    (vendor.phone ? 8 : 0) +
    (vendor.email ? 8 : 0) +
    (vendor.notes ? 4 : 0) +
    (vendor.defaultCategory ? 2 : 0)
  );
}

export function formatUsPhone(value) {
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

  const a = working.slice(0, 3);
  const b = working.slice(3, 6);
  const c = working.slice(6, 10);

  let formatted = "";
  if (working.length <= 3) {
    formatted = a;
  } else if (working.length <= 6) {
    formatted = `(${a}) ${b}`;
  } else {
    formatted = `(${a}) ${b}-${c}`;
  }

  return country ? `+1 ${formatted}` : formatted;
}
