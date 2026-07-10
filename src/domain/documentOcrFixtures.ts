export const DOCUMENT_OCR_FIXTURES = {
  spectrumInternetStatement: {
    name: "Internet June 17, 2026.pdf",
    text: [
      "Spectrum Hi, Sample Owner!",
      "Amount Due $40",
      "Statement Date Jun 17, 2026 Due by Jul 04",
      "Service Address 614 S Sample Ave Sampleville, WI 53000",
      "Billing Period Jun 17 - Jul 16 | Account 8285 11 078",
      "Spectrum Internet Premier $85",
      "Promotional Discount -$55",
      "Spectrum Internet Total $40",
    ].join("\n"),
  },
} as const;
