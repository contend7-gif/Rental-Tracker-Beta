export const BANK_IMPORT_MATCH_RULE_OPTIONS = {
  standard: {
    label: "Standard",
    hint: "Balanced matching (recommended)",
    options: { amountTolerance: 0.01, daysWindow: 5, minimumConfidence: "medium" },
  },
  strict: {
    label: "Strict",
    hint: "Fewer false matches",
    options: { amountTolerance: 0.01, daysWindow: 2, minimumConfidence: "high" },
  },
  lenient: {
    label: "Lenient",
    hint: "More auto matches",
    options: { amountTolerance: 1, daysWindow: 7, minimumConfidence: "low" },
  },
};
