import test from "node:test";
import assert from "node:assert/strict";
import {
  documentNeedsIndexing,
  documentNeedsOcr,
  documentNeedsTags,
  documentSupportsAutomaticOcr,
  inferDocumentExpenseSuggestion,
  inferDocumentExtractedFields,
  inferDocumentLinkSuggestions,
  inferDocumentTags,
  inferDocumentTagSuggestions,
  inferDocumentUtilitySections,
  inferDocumentWorkOrderSuggestion,
  normalizeDocumentOcrStatus,
  normalizeExtractedDocumentText,
  suggestDocumentType,
} from "./documentIntelligence.ts";

test("documentNeedsTags and documentNeedsIndexing flag missing metadata", () => {
  assert.equal(documentNeedsTags({ tags: [] }), true);
  assert.equal(documentNeedsTags({ tags: ["lease"] }), false);
  assert.equal(documentNeedsIndexing({ extractedText: "" }), true);
  assert.equal(documentNeedsIndexing({ extractedText: "Signed lease text" }), false);
});

test("normalizeDocumentOcrStatus favors completed when extracted text exists", () => {
  assert.equal(normalizeDocumentOcrStatus("pending", "recognized text"), "completed");
  assert.equal(normalizeDocumentOcrStatus("pending", ""), "pending");
  assert.equal(normalizeDocumentOcrStatus("", ""), "not_needed");
  assert.equal(documentNeedsOcr({ ocrStatus: "pending", extractedText: "" }), true);
  assert.equal(documentNeedsOcr({ ocrStatus: "completed", extractedText: "recognized" }), false);
});

test("suggestDocumentType recognizes common scanned document types", () => {
  assert.equal(suggestDocumentType("Lease-102.pdf", "application/pdf"), "Lease PDF");
  assert.equal(suggestDocumentType("Vendor-Invoice.jpg", "image/jpeg"), "Invoice");
  assert.equal(suggestDocumentType("UnknownScan.png", "image/png"), "Scanned Image");
});

test("documentSupportsAutomaticOcr recognizes supported pdf and image types", () => {
  assert.equal(documentSupportsAutomaticOcr("lease.pdf", "application/pdf"), true);
  assert.equal(documentSupportsAutomaticOcr("invoice.jpeg", "image/jpeg"), true);
  assert.equal(documentSupportsAutomaticOcr("inspection.webp", "image/webp"), true);
  assert.equal(documentSupportsAutomaticOcr("notes.txt", "text/plain"), false);
  assert.equal(documentSupportsAutomaticOcr("scan-without-mime.png", ""), true);
});

test("normalizeExtractedDocumentText trims noisy OCR spacing", () => {
  assert.equal(
    normalizeExtractedDocumentText(" Rent due\r\n\r\n\r\n  $1350\u000c"),
    "Rent due\n\n$1350",
  );
});

test("normalizeExtractedDocumentText adds structure to noisy utility OCR", () => {
  const normalized = normalizeExtractedDocumentText(
    "Billing Date 3/31 /2026 Page 2 of 3 Account ACCT-TEST-001 Total For: 101 EXAMPLE AVE Charge 7.76 18.90 4.87 83.55",
  );

  assert.match(normalized, /Billing Date:?\s*3\/31\/2026/i);
  assert.match(normalized, /\nPage 2 of 3\n/i);
  assert.match(normalized, /\nAccount ACCT-TEST-001\n/i);
  assert.match(normalized, /\nTotal For: 101 EXAMPLE AVE\n/i);
  assert.match(normalized, /\nCharge 7\.76 18\.90 4\.87 83\.55/i);
});

test("inferDocumentTags suggests lease and tenant context tags", () => {
  const tags = inferDocumentTags({
    document: { name: "Lease-102-Renewal.pdf", type: "Lease PDF", tags: [] },
    lease: { id: "l1", tenantName: "Jordan Lee", unit: "102", propertyId: "p1" },
  });

  assert.ok(tags.includes("lease"));
  assert.ok(tags.includes("lease pdf"));
  assert.ok(tags.includes("tenant"));
  assert.ok(tags.includes("jordan lee"));
  assert.ok(tags.includes("unit-102"));
});

test("inferDocumentTags suggests OCR-derived tags from indexed text", () => {
  const tags = inferDocumentTags({
    document: {
      name: "scan001.pdf",
      type: "Scanned PDF",
      tags: [],
      extractedText: "Residential lease renewal for Apartment 12B. Monthly rent is $1,350 and security deposit remains on file.",
    },
  });

  assert.ok(tags.includes("scan"));
  assert.ok(tags.includes("lease"));
  assert.ok(tags.includes("renewal"));
  assert.ok(tags.includes("rent"));
  assert.ok(tags.includes("security deposit"));
  assert.ok(tags.includes("unit-12b"));
});

test("inferDocumentTagSuggestions matches vendor, tenant, and property from OCR text with source labels", () => {
  const suggestions = inferDocumentTagSuggestions({
    document: {
      name: "scan001.pdf",
      type: "Scanned PDF",
      tags: [],
      extractedText: "Rapid Rooter Plumbing completed work at 101 Example Ave for Jordan Lee in Unit 102.",
    },
    candidateVendors: [{ name: "Rapid Rooter Plumbing" }, { name: "Blue Sky Electric" }],
    candidateLeases: [{ id: "l1", tenantName: "Jordan Lee", unit: "102", propertyId: "p1" }],
    candidateProperties: [{ id: "p1", name: "Oak Duplex", address: "101 Example Ave" }],
  });

  const byTag = Object.fromEntries(suggestions.map((suggestion) => [suggestion.tag, suggestion.sources.join(",")]));
  assert.equal(byTag["rapid rooter plumbing"], "ocr_match");
  assert.equal(byTag["vendor"], "ocr_match");
  assert.equal(byTag["jordan lee"], "ocr_match");
  assert.equal(byTag["tenant"], "ocr_match");
  assert.equal(byTag["oak duplex"], "ocr_match");
  assert.ok(byTag["unit-102"].includes("ocr"));
});

test("inferDocumentLinkSuggestions suggests lease, work order, and transaction links from OCR text", () => {
  const suggestions = inferDocumentLinkSuggestions({
    document: {
      name: "scan001.pdf",
      type: "Scanned PDF",
      tags: [],
      extractedText: "Rapid Rooter Plumbing invoice for Jordan Lee at 101 Example Ave Apt 102. Kitchen sink leak repair complete.",
    },
    candidateProperties: [{ id: "p1", name: "Oak Duplex", address: "101 Example Ave" }],
    candidateLeases: [{ id: "l1", tenantName: "Jordan Lee", unit: "102", propertyId: "p1" }],
    candidateTransactions: [{ id: "t1", date: "2026-03-12", vendor: "Rapid Rooter Plumbing", category: "Repairs", description: "Kitchen sink leak repair", unit: "102", propertyId: "p1", type: "Expense", amount: 460 }],
    candidateWorkOrders: [{ id: "wo1", title: "Kitchen sink leak", description: "Repair under sink in unit 102", unit: "102", propertyId: "p1", priority: "High", vendorName: "Rapid Rooter Plumbing" }],
  });

  const leaseSuggestion = suggestions.find((suggestion) => suggestion.kind === "lease");
  const transactionSuggestion = suggestions.find((suggestion) => suggestion.kind === "transaction");
  const workOrderSuggestion = suggestions.find((suggestion) => suggestion.kind === "workOrder");

  assert.equal(leaseSuggestion?.id, "l1");
  assert.equal(leaseSuggestion?.confidence, "high");
  assert.equal(transactionSuggestion?.id, "t1");
  assert.equal(workOrderSuggestion?.id, "wo1");
});

test("inferDocumentTags suggests maintenance, invoice, and vendor tags for work order files", () => {
  const tags = inferDocumentTags({
    document: { name: "Rapid-Rooter-Invoice.pdf", type: "Invoice", tags: [] },
    workOrder: { id: "wo1", title: "Kitchen sink leak", description: "Repair under sink", priority: "High", unit: "102", propertyId: "p1" },
    vendor: { name: "Rapid Rooter Plumbing" },
  });

  assert.ok(tags.includes("invoice"));
  assert.ok(tags.includes("maintenance"));
  assert.ok(tags.includes("work order"));
  assert.ok(tags.includes("high"));
  assert.ok(tags.includes("rapid rooter plumbing"));
  assert.ok(tags.includes("vendor"));
  assert.ok(tags.includes("unit-102"));
});

test("inferDocumentExpenseSuggestion extracts invoice draft details from OCR text", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "scan001.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      extractedText: "Rapid Rooter Plumbing Invoice # RR-2048\nInvoice Date: 03/14/2026\nService at 101 Example Ave Unit 102\nKitchen sink leak repair\nTotal Due $460.00",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
    candidateUnits: [{ propertyId: "p1", name: "102" }],
    candidateVendors: [
      { id: "v1", name: "Rapid Rooter Plumbing", defaultCategory: "Repairs" },
      { id: "v2", name: "Blue Sky Electric", defaultCategory: "Repairs" },
    ],
  });

  assert.equal(suggestion?.vendor, "Rapid Rooter Plumbing");
  assert.equal(suggestion?.category, "Repairs");
  assert.equal(suggestion?.amount, 460);
  assert.equal(suggestion?.date, "2026-03-14");
  assert.equal(suggestion?.invoiceRef, "RR-2048");
  assert.equal(suggestion?.propertyId, "p1");
  assert.equal(suggestion?.unit, "102");
  assert.equal(suggestion?.confidence, "high");
});

test("inferDocumentExpenseSuggestion carries utility billing periods into the draft", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "example-gas.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      extractedText: "Example Gas Utility bill date 03/13/2026. Bill Period: 02/13/2026 to 03/12/2026. Service address 102 Example Ave. Amount Due $97.59",
    },
    property: { id: "p1", name: "Example Duplex", address: "102 Example Ave" },
    candidateUnits: [{ propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example Gas Utility", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion?.servicePeriodStart, "2026-02-13");
  assert.equal(suggestion?.servicePeriodEnd, "2026-03-12");
});

test("inferDocumentExpenseSuggestion derives utility service periods from meter read dates", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "mu-utilities.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "101",
      extractedText: [
        "Example City Utilities",
        "101 Example Ave",
        "Billing Date: 03/31/2026",
        "Water service",
        "Previous Read 02/15/2026 32088",
        "Current Read 03/15/2026 32356",
        "Amount Due $83.55",
        "Charge 7.76 18.90 4.87 83.55",
      ].join("\n"),
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion?.servicePeriodStart, "2026-02-15");
  assert.equal(suggestion?.servicePeriodEnd, "2026-03-15");
});

test("inferDocumentExpenseSuggestion does not use next meter read date as transaction date", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "example-energy.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "101",
      extractedText: [
        "Example Energy",
        "101 Example Ave",
        "Next Meter Read Date: 06/12/2026",
        "Billing Date: 05/14/2026",
        "Previous Read 04/14/2026 32088",
        "Current Read 05/13/2026 32356",
        "Amount Due $83.55",
      ].join("\n"),
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example Energy", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion?.date, "2026-05-14");
  assert.equal(suggestion?.servicePeriodStart, "2026-04-14");
  assert.equal(suggestion?.servicePeriodEnd, "2026-05-13");
});

test("inferDocumentExpenseSuggestion prefers OCR unit matches over a shared draft default", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "example-gas.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: "Example Gas Utility bill dated 03/13/2026 for service address 102 Example Ave. Unit Shared. Amount Due $97.59",
    },
    property: { id: "p1", name: "Example Duplex", address: "Example Duplex" },
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example Gas Utility", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion?.unit, "102");
  assert.equal(suggestion?.amount, 97.59);
});

test("inferDocumentExpenseSuggestion uses linked work order context when OCR is sparse", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "receipt.jpg",
      type: "Receipt",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: "Receipt\nAmount Due $125.50",
    },
    workOrder: {
      id: "wo1",
      title: "Replace hallway light",
      description: "Install new fixture",
      priority: "Medium",
      unit: "Shared",
      propertyId: "p1",
      reportedOn: "2026-03-10",
      completedAt: "2026-03-12",
    },
    vendor: { id: "v1", name: "Blue Sky Electric", defaultCategory: "Repairs" },
  });

  assert.equal(suggestion?.vendor, "Blue Sky Electric");
  assert.equal(suggestion?.category, "Repairs");
  assert.equal(suggestion?.amount, 125.5);
  assert.equal(suggestion?.date, "2026-03-12");
  assert.equal(suggestion?.description, "Work order: Replace hallway light");
});

test("inferDocumentExpenseSuggestion skips lease summary packets with rent and deposit amounts", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "seller-lease-packet.pdf",
      type: "Lease summary",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Seller lease packet summary. Unit 102 rent $1,400. Security deposit $700. Pet fee $200. Cleaning fee $200.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(suggestion, null);
});

test("inferDocumentExpenseSuggestion skips loan servicing summaries", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "loan-servicing-summary.txt",
      type: "Servicing summary",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Loan servicing summary. PMI premium $68.37. Hazard insurance premium $1,226.00 due 12/30/2026. Town tax $3,435.72 due 12/1/2026.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(suggestion, null);
});

test("inferDocumentExpenseSuggestion skips personal property schedules", () => {
  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "personal-property.pdf",
      type: "Personal property schedule",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Personal property schedule from closing. Unit 101 furnishings $4,685. Unit 102 furnishings $5,310. Total $9,995.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(suggestion, null);
});

test("inferDocumentExtractedFields captures structured invoice details and vendor contact info", () => {
  const fields = inferDocumentExtractedFields({
    document: {
      name: "scan001.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      extractedText: [
        "Rapid Rooter Plumbing",
        "Phone: (715) 444-2223",
        "billing@rapidrooter.com",
        "Invoice # RR-2048",
        "Invoice Date: 03/14/2026",
        "Service Date: 03/13/2026",
        "Due Date: 03/28/2026",
        "101 Example Ave Unit 102",
        "Kitchen sink leak repair",
        "Subtotal $425.00",
        "Tax $35.00",
        "Total Due $460.00",
      ].join("\n"),
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
    candidateUnits: [{ propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Rapid Rooter Plumbing", defaultCategory: "Repairs", phone: "715-444-2223", email: "billing@rapidrooter.com" }],
  });

  assert.equal(fields?.vendorName, "Rapid Rooter Plumbing");
  assert.equal(fields?.vendorPhone, "715-444-2223");
  assert.equal(fields?.vendorEmail, "billing@rapidrooter.com");
  assert.equal(fields?.invoiceRef, "RR-2048");
  assert.equal(fields?.invoiceDate, "2026-03-14");
  assert.equal(fields?.serviceDate, "2026-03-13");
  assert.equal(fields?.dueDate, "2026-03-28");
  assert.equal(fields?.propertyId, "p1");
  assert.equal(fields?.propertyAddress, "101 Example Ave");
  assert.equal(fields?.unit, "102");
  assert.equal(fields?.subtotal, 425);
  assert.equal(fields?.taxAmount, 35);
  assert.equal(fields?.totalAmount, 460);
  assert.equal(fields?.serviceSummary, "Kitchen sink leak repair");
  assert.equal(fields?.confidence, "high");
});

test("inferDocumentExtractedFields prefers OCR unit matches over a shared document default", () => {
  const fields = inferDocumentExtractedFields({
    document: {
      name: "example-gas.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: [
        "Example Gas Utility",
        "Invoice 2026-03-13",
        "Service address 102 Example Ave",
        "Unit Shared",
        "Amount Due $97.59",
      ].join("\n"),
    },
    property: { id: "p1", name: "Example Duplex", address: "Example Duplex" },
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example Gas Utility", defaultCategory: "Utilities" }],
  });

  assert.equal(fields?.unit, "102");
  assert.equal(fields?.totalAmount, 97.59);
});

test("inferDocumentExtractedFields falls back to contextual vendor contact details", () => {
  const fields = inferDocumentExtractedFields({
    document: {
      name: "receipt.jpg",
      type: "Receipt",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: "Receipt\nDate: 03/12/2026\nAmount Due $125.50",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
    vendor: { id: "v1", name: "Blue Sky Electric", phone: "715-333-1111", email: "office@blueskyelectric.com", defaultCategory: "Repairs" },
  });

  assert.equal(fields?.vendorName, "Blue Sky Electric");
  assert.equal(fields?.vendorPhone, "715-333-1111");
  assert.equal(fields?.vendorEmail, "office@blueskyelectric.com");
  assert.equal(fields?.totalAmount, 125.5);
  assert.equal(fields?.invoiceDate, "2026-03-12");
});

test("inferDocumentUtilitySections detects multi-address utility statements and drafts the in-portfolio section", () => {
  const text = [
    "BILLING STATEMENT Example City Utilities",
    "Account # ACCT-TEST-001",
    "Billing Date: 02/28/2026",
    "Bill Period: 01/29/2026 to 02/26/2026",
    "101-102 Example Ave Sampleville WI 53000",
    "Amount Due $194.09",
    "Account # ACCT-TEST-003",
    "Billing Date: 02/28/2026",
    "Bill Period: 01/29/2026 to 02/26/2026",
    "999 EXAMPLE SERVICE RD SAMPLEVILLE WI 53000",
    "Amount Due $325.30",
  ].join("\n");

  const sections = inferDocumentUtilitySections({
    document: {
      name: "mu utilities 022826 billing.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [
      { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    ],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.equal(sections.length, 2);
  assert.equal(sections[0]?.propertyId, "p1");
  assert.equal(sections[0]?.unit, "Shared");
  assert.equal(sections[1]?.external, true);

  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "mu utilities 022826 billing.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [
      { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    ],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion?.propertyId, "p1");
  assert.equal(suggestion?.unit, "Shared");
  assert.equal(suggestion?.amount, 194.09);
  assert.equal(suggestion?.servicePeriodStart, "2026-01-29");
  assert.equal(suggestion?.servicePeriodEnd, "2026-02-26");
});

test("inferDocumentExpenseSuggestion suppresses utility drafts when multiple in-portfolio sections exist", () => {
  const text = [
    "BILLING STATEMENT Example City Utilities",
    "Account # ACCT-TEST-001",
    "Billing Date: 02/28/2026",
    "Bill Period: 01/29/2026 to 02/26/2026",
    "101 Example Ave Sampleville WI 53000",
    "Amount Due $94.09",
    "Account # ACCT-TEST-002",
    "Billing Date: 02/28/2026",
    "Bill Period: 01/29/2026 to 02/26/2026",
    "102 Example Ave Sampleville WI 53000",
    "Amount Due $100.00",
  ].join("\n");

  const suggestion = inferDocumentExpenseSuggestion({
    document: {
      name: "multi unit utilities 022826 billing.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [
      { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    ],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.equal(suggestion, null);
});

test("inferDocumentUtilitySections extracts Spectrum-style spaced PDF labels", () => {
  const text = [
    "4145 S SAMPLE REMIT RD EXAMPLE FL 33578",
    "Please send payment to:",
    "S P E C T R U M",
    "PO BOX 00000",
    "Example IL 60000",
    "Sample Owner",
    "100 EXAMPLE ST",
    "SAMPLEVILLE WI 53000",
    "A m o u n t D u e $40",
    "D u e b y J u n 04",
    "A c c o u n t N u m b e r 8285 11 078 0000000",
    "A C C O U N T N U M B E R S T A T E M E N T D A T E S E R V I C E A D D R E S S",
    "8285 11 078 0000000 M a y 17, 2026 100 E X A M P L E S T",
    "S A M P L E V I L L E , W I 53000",
    "A m o u n t D u e D u e b y",
    "$40 J u n 04",
    "H o w I t A d d s U p S e r v i c e f r o m M ay 17 - J u n 16",
    "P r e v i o u s B al an c e $40",
    "C r e d i t C ar d P ay m e n t 05/02 -$40",
    "R e m ai n i n g B al an c e $0",
    "S p e c t r u m I n t e r n e t P r e m i e r $85",
    "Pr o m o t i o n al D i s c o u n t -$55",
    "A d v an c e d W i F i $10",
    "S p e c t r u m I n t e r n e t T o t al $40",
  ].join("\n");

  const args = {
    document: {
      name: "statement_05-16-2026.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Sample Duplex", address: "100 Example St" },
    candidateProperties: [
      { id: "p1", name: "Sample Duplex", address: "100 Example St" },
    ],
    candidateUnits: [{ propertyId: "p1", name: "Unit A" }, { propertyId: "p1", name: "Unit B" }],
    candidateVendors: [{ id: "v1", name: "Spectrum", defaultCategory: "Utilities" }],
  };

  const sections = inferDocumentUtilitySections(args);
  const internalSection = sections.find((section) => !section.external);
  assert.equal(internalSection?.propertyId, "p1");
  assert.equal(internalSection?.amount, 40);
  assert.equal(internalSection?.servicePeriodStart, "2026-05-17");
  assert.equal(internalSection?.servicePeriodEnd, "2026-06-16");

  const suggestion = inferDocumentExpenseSuggestion(args);
  assert.equal(suggestion?.propertyId, "p1");
  assert.equal(suggestion?.vendor, "Spectrum");
  assert.equal(suggestion?.amount, 40);
  assert.equal(suggestion?.servicePeriodStart, "2026-05-17");
  assert.equal(suggestion?.servicePeriodEnd, "2026-06-16");
});

test("inferDocumentUtilitySections matches a ranged property address to the in-portfolio unit section", () => {
  const text = [
    "Example Gas Utility",
    "Bill Date 03/13/2026",
    "Bill Period: 02/13/2026 to 03/12/2026",
    "2026 ALEX EXAMPLE 102 EXAMPLE AVE SAMPLEVILLE WI 53000",
    "Amount Due $97.59",
    "Account # ACCT-TEST-002",
    "999 EXAMPLE SERVICE RD SAMPLEVILLE WI 53000",
    "Amount Due $325.30",
  ].join("\n");

  const sections = inferDocumentUtilitySections({
    document: {
      name: "example-gas-bill.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example Gas Utility", defaultCategory: "Utilities" }],
  });

  assert.equal(sections.length, 2);
  assert.equal(sections[0]?.propertyId, "p1");
  assert.equal(sections[0]?.external, false);
  assert.equal(sections[0]?.unit, "102");
  assert.equal(sections[1]?.external, true);
});

test("inferDocumentUtilitySections drops low-signal shadow addresses from utility OCR text", () => {
  const text = [
    "Example City Utilities",
    "Billing Date: 03/31/2026",
    "Account # ACCT-TEST-004",
    "101 EXAMPLE AVE SAMPLEVILLE WI 53000",
    "Amount Due $47.15",
    "102 EXAMPLE AVE",
  ].join("\n");

  const sections = inferDocumentUtilitySections({
    document: {
      name: "mu utilities 03312026.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.equal(sections.length, 1);
  assert.equal(sections[0]?.address, "101 EXAMPLE AVE");
});

test("inferDocumentUtilitySections ignores utility office remittance addresses and preserves explicit unit matches", () => {
  const text = [
    "BILLING STATEMENT Example City Utilities",
    "ALEX EXAMPLE 101 EXAMPLE AVE SAMPLEVILLE, WI 53000",
    "Amount Due $47.15",
    "Page 1 of 3 Account #: ACCT-TEST-001 Billing Date: 3/31/2026",
    "Example City Utilities 2000 S Central Ave Sampleville, WI 53000 833-2504481 for PAYMENTS 715-387-1195 for QUESTIONS",
    "Keep this top portion for your records.",
    "ALEX EXAMPLE 101 EXAMPLE AVE SAMPLEVILLE, WI 53000 Current Read Previous Read Multiplier Days / Usage",
    "Page 2 of 3 Account ACCT-TEST-001 Billing Date: 313112026 Notes: Service Meter / Rate WATER Pub Fire Protection Res City Charges Sewer Fixed Charge Sewer Volume Charge 114.250 UNIT @ .0426",
    "Total For: 101 EXAMPLE AVE",
    "ELECTRIC Meter Customer Charge Residential Kwh 334 KWH @ .0907 Power Cost Adjustment 334 @ -.0087",
    "WATER Meter Customer Charge 5/8\" Volume Charge-Cu.Ft. 164.480 UNIT @ .0524",
    "03/15/2026 4.87 03/15/2026 42393 30.29 -2.91 03/15/2026 3255197 8.62",
    "02/15/2026 42059 02/15/2026 3238749",
    "Charge 7.76 18.90 4.87 83.55 13.00 30.29 -2.91 1.07 10.00 8.62 7.76",
    "Page 3 of 3 Account ACCT-TEST-001 Billing Date: 313112026",
    "Total For: 102 EXAMPLE AVE",
    "ALEX EXAMPLE 101 EXAMPLE AVE SAMPLEVILLE, WI 53000",
    "Charge 18.90 7.01 93.74",
  ].join("\n");

  const sections = inferDocumentUtilitySections({
    document: {
      name: "mu utilities 03312026.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: text,
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  assert.deepEqual(sections.map((section) => section.address), ["101 EXAMPLE AVE", "102 EXAMPLE AVE"]);
  assert.ok(sections.every((section) => section.propertyId === "p1"));
  assert.equal(sections[0]?.unit, "101");
  assert.equal(sections[1]?.unit, "102");
  assert.equal(sections[1]?.amount, 93.74);
});

test("inferDocumentLinkSuggestions ranks the exact utility transaction above stale matches", () => {
  const suggestions = inferDocumentLinkSuggestions({
    document: {
      name: "example-gas-bill.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: [
        "Example Gas Utility",
        "Invoice 5852386623",
        "Bill Date 03/13/2026",
        "Bill Period: 02/13/2026 to 03/12/2026",
        "102 EXAMPLE AVE SAMPLEVILLE WI 53000",
        "Amount Due $97.59",
      ].join("\n"),
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateTransactions: [
      {
        id: "tx-stale",
        date: "2026-02-06",
        vendor: "Example Gas Utility",
        category: "Utilities",
        description: "Example Gas Utility utilities",
        unit: "102",
        propertyId: "p1",
        type: "Expense",
        amount: 91.41,
        invoiceRef: "OLD-REF",
      },
      {
        id: "tx-rent",
        date: "2026-01-29",
        vendor: "Taylor Morgan",
        category: "Rent",
        description: "February rent",
        unit: "102",
        propertyId: "p1",
        type: "Income",
        amount: 900,
        invoiceRef: "",
      },
      {
        id: "tx-exact",
        date: "2026-03-13",
        vendor: "Example Gas Utility",
        category: "Utilities",
        description: "Gas",
        unit: "102",
        propertyId: "p1",
        type: "Expense",
        amount: 97.59,
        invoiceRef: "5852386623",
      },
    ],
    candidateVendors: [{ id: "v1", name: "Example Gas Utility", defaultCategory: "Utilities" }],
  });

  const transactionSuggestions = suggestions.filter((suggestion) => suggestion.kind === "transaction");
  assert.equal(transactionSuggestions[0]?.id, "tx-exact");
  assert.equal(transactionSuggestions[0]?.confidence, "high");
});

test("inferDocumentLinkSuggestions uses the matched in-portfolio utility section to beat noisy statement history", () => {
  const suggestions = inferDocumentLinkSuggestions({
    document: {
      name: "mu utilities 03312026.pdf",
      type: "Scanned PDF",
      tags: [],
      propertyId: "p1",
      unit: "Shared",
      extractedText: [
        "BILLING STATEMENT Example City Utilities",
        "Account # ACCT-TEST-001",
        "Billing Date: 03/16/2026",
        "999 EXAMPLE SERVICE RD SAMPLEVILLE WI 53000",
        "Amount Due $194.09",
        "Account # ACCT-TEST-004",
        "101 EXAMPLE AVE SAMPLEVILLE WI 53000",
        "Customer Charge 47.15",
      ].join("\n"),
    },
    property: { id: "p1", name: "Example Duplex", address: "101-102 Example Ave" },
    candidateProperties: [{ id: "p1", name: "Example Duplex", address: "101-102 Example Ave" }],
    candidateUnits: [{ propertyId: "p1", name: "101" }, { propertyId: "p1", name: "102" }],
    candidateTransactions: [
      {
        id: "tx-history",
        date: "2026-03-16",
        vendor: "Example City Utilities",
        category: "Utilities",
        description: "Example City Utilities",
        unit: "Shared",
        propertyId: "p2",
        type: "Expense",
        amount: 194.09,
        invoiceRef: "ACCT-TEST-001",
      },
      {
        id: "tx-current",
        date: "2026-03-31",
        vendor: "Example City Utilities",
        category: "Utilities",
        description: "Example City Utilities",
        unit: "101",
        propertyId: "p1",
        type: "Expense",
        amount: 47.15,
        invoiceRef: "ACCT-TEST-004",
      },
    ],
    candidateVendors: [{ id: "v1", name: "Example City Utilities", defaultCategory: "Utilities" }],
  });

  const transactionSuggestions = suggestions.filter((suggestion) => suggestion.kind === "transaction");
  assert.equal(transactionSuggestions[0]?.id, "tx-current");
  assert.match(transactionSuggestions[0]?.label || "", /\| Unit 101$/);
});

test("inferDocumentWorkOrderSuggestion builds a maintenance draft from OCR text", () => {
  const suggestion = inferDocumentWorkOrderSuggestion({
    document: {
      name: "repair-estimate.pdf",
      type: "Estimate",
      propertyId: "p1",
      tags: [],
      extractedText: "Rapid Rooter Plumbing estimate\n03/14/2026\n101 Example Ave Unit 102\nKitchen sink leak repair\nEstimate total $460.00",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
    candidateVendors: [{ id: "v1", name: "Rapid Rooter Plumbing", defaultCategory: "Repairs" }],
  });

  assert.equal(suggestion?.title, "Kitchen sink leak repair");
  assert.equal(suggestion?.priority, "High");
  assert.equal(suggestion?.vendor, "Rapid Rooter Plumbing");
  assert.equal(suggestion?.vendorId, "v1");
  assert.equal(suggestion?.estimatedCost, 460);
  assert.equal(suggestion?.reportedOn, "2026-03-14");
  assert.equal(suggestion?.propertyId, "p1");
  assert.equal(suggestion?.unit, "102");
  assert.equal(suggestion?.confidence, "high");
});

test("inferDocumentWorkOrderSuggestion skips non-maintenance document text", () => {
  const suggestion = inferDocumentWorkOrderSuggestion({
    document: {
      name: "lease-renewal.pdf",
      type: "Lease PDF",
      propertyId: "p1",
      tags: [],
      extractedText: "Lease renewal for Jordan Lee at 101 Example Ave unit 102.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(suggestion, null);
});

test("inferDocumentWorkOrderSuggestion skips lease summaries and servicing summaries", () => {
  const leaseSuggestion = inferDocumentWorkOrderSuggestion({
    document: {
      name: "seller-lease-packet.pdf",
      type: "Lease summary",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Seller lease packet summary. Unit 102: Taylor Morgan, monthly rent $1,400, $700 security deposit.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });
  const servicingSuggestion = inferDocumentWorkOrderSuggestion({
    document: {
      name: "loan-servicing-summary.txt",
      type: "Servicing summary",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Loan servicing summary. PMI premium $68.37 and hazard insurance premium $1,226.00 due later this year.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(leaseSuggestion, null);
  assert.equal(servicingSuggestion, null);
});

test("inferDocumentWorkOrderSuggestion skips personal property schedules", () => {
  const suggestion = inferDocumentWorkOrderSuggestion({
    document: {
      name: "personal-property.pdf",
      type: "Personal property schedule",
      propertyId: "p1",
      unit: "Shared",
      tags: [],
      extractedText: "Personal property schedule from closing. Unit 101 furnishings $4,685. Unit 102 furnishings $5,310. Combined total $9,995.",
    },
    property: { id: "p1", name: "Oak Duplex", address: "101 Example Ave" },
  });

  assert.equal(suggestion, null);
});
