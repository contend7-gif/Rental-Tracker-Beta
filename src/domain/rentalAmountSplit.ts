// Dollar entry is another input for the existing percentage override, not a second allocation.
export function rentalAmountSplit(total: number, input: string): { ownerUsePct: string; error?: never } | { error: string; ownerUsePct?: never } {
  if (!Number.isFinite(total) || total <= 0) return { error: "Enter a positive bill total before setting the rental amount." };
  if (!/^\d+(?:\.\d{0,2})?$/.test(input.trim())) return { error: "Enter a rental amount in dollars and cents, including 0 for no rental use." };
  const rental = Number(input);
  if (!Number.isFinite(rental) || rental < 0 || rental > total) return { error: "Rental amount must be between $0 and the bill total." };
  // Keep full precision so non-round percentages preserve the entered cents on save.
  return { ownerUsePct: String((1 - rental / total) * 100) };
}
