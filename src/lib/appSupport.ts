import { currency } from "../domain/accounting.ts";

export function formatDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function addDaysToIso(dateText: unknown, offset: unknown) {
  const date = new Date(`${String(dateText || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + Number(offset || 0));
  return date.toISOString().slice(0, 10);
}

export function buildChartPolyline(values: unknown[], minValue: number, maxValue: number, width = 320, height = 120, padding = 12) {
  if (!Array.isArray(values) || values.length === 0) return "";
  const min = Number.isFinite(minValue) ? minValue : 0;
  const max = Number.isFinite(maxValue) ? maxValue : 0;
  const span = Math.max(1, max - min);
  const innerWidth = Math.max(1, width - (padding * 2));
  const innerHeight = Math.max(1, height - (padding * 2));
  return values
    .map((value, index) => {
      const x = padding + ((values.length === 1 ? 0.5 : index / Math.max(1, values.length - 1)) * innerWidth);
      const normalized = (Number(value || 0) - min) / span;
      const y = height - padding - (normalized * innerHeight);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}

export function buildChartAxisY(minValue: number, maxValue: number, width = 320, height = 120, padding = 12) {
  const min = Number.isFinite(minValue) ? minValue : 0;
  const max = Number.isFinite(maxValue) ? maxValue : 0;
  if (min > 0 || max < 0) return null;
  const span = Math.max(1, max - min);
  const innerHeight = Math.max(1, height - (padding * 2));
  const normalized = (0 - min) / span;
  return height - padding - (normalized * innerHeight);
}

export function buildChartPointX(index: number, total: number, width = 320, padding = 12) {
  const innerWidth = Math.max(1, width - (padding * 2));
  return padding + ((total <= 1 ? 0.5 : index / Math.max(1, total - 1)) * innerWidth);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function readStoredAutoBackups(raw: string | null | undefined) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => isRecord(item) && isRecord(item.data));
  } catch {
    return [];
  }
}

export function readLastAutoBackupAt(rawMeta: string | null | undefined) {
  if (!rawMeta) return "";
  try {
    const parsed = JSON.parse(rawMeta);
    if (!isRecord(parsed)) return "";
    return typeof parsed.lastAutoBackupAt === "string" ? parsed.lastAutoBackupAt : "";
  } catch {
    return "";
  }
}

export function readLeaseReminderNotificationMap(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) return {};
    return Object.entries(parsed).reduce<Record<string, string>>((map, [key, value]) => {
      if (typeof value === "string" && key) {
        map[key] = value;
      }
      return map;
    }, {});
  } catch {
    return {};
  }
}

export function leaseReminderToneClass(kind: string) {
  if (kind === "late") return "border-rose-200 bg-rose-50 text-rose-800";
  if (kind === "due_today") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
}

export function leaseReminderKindLabel(kind: string) {
  if (kind === "late") return "Late";
  if (kind === "due_today") return "Due today";
  return "Due soon";
}

export function downloadTextAsFile(text: unknown, fileName: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([String(text || "")], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function copyTextToClipboard(text: unknown) {
  const normalized = String(text || "");
  if (!normalized) return false;
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(normalized);
      return true;
    } catch {
      // Fall through to the legacy copy path when browser clipboard permission is denied.
    }
  }
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = normalized;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function sanitizeFileNamePart(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function printHtmlDocument(printHtml: string) {
  if (typeof document === "undefined") return false;

  const printFrame = document.createElement("iframe");
  printFrame.style.position = "fixed";
  printFrame.style.right = "0";
  printFrame.style.bottom = "0";
  printFrame.style.width = "0";
  printFrame.style.height = "0";
  printFrame.style.border = "0";
  printFrame.setAttribute("aria-hidden", "true");
  document.body.appendChild(printFrame);

  const cleanup = () => {
    if (printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }
  };

  const frameDoc = printFrame.contentWindow?.document;
  if (!frameDoc || !printFrame.contentWindow) {
    cleanup();
    return false;
  }

  frameDoc.open();
  frameDoc.write(printHtml);
  frameDoc.close();

  setTimeout(() => {
    try {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    } finally {
      setTimeout(cleanup, 2000);
    }
  }, 120);

  return true;
}

export function formatStatementMonthLabel(monthText: unknown) {
  const raw = String(monthText || "").trim();
  if (!/^\d{4}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(`${raw}-01T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatStatementDateRangeLabel(range: { start?: string; end?: string } | null | undefined) {
  if (!range?.start || !range?.end) return "No dated activity";
  if (range.start === range.end) return range.start;
  return `${range.start} to ${range.end}`;
}

export function buildStatementBranding(appSettings: Record<string, unknown> | null | undefined) {
  const name = String(appSettings?.statementBusinessName || "").trim();
  const address = String(appSettings?.statementBusinessAddress || "").trim();
  const email = String(appSettings?.statementBusinessEmail || "").trim();
  const phone = String(appSettings?.statementBusinessPhone || "").trim();
  const logoDataUrl = String(appSettings?.statementLogoDataUrl || "").trim();
  if (!name && !address && !email && !phone && !logoDataUrl) return null;
  return {
    name,
    addressLines: address ? address.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [],
    contactLine: [phone, email].filter(Boolean).join(" | "),
    logoDataUrl,
  };
}

export function buildOwnerContactDefaults(appSettings: Record<string, unknown> | null | undefined) {
  return {
    ownerName: String(appSettings?.statementOwnerRecipient || "").trim(),
    ownerEmail: String(appSettings?.statementOwnerEmail || "").trim(),
    ownerPhone: String(appSettings?.statementOwnerPhone || "").trim(),
  };
}

export function buildEffectiveOwnerContact(property: Record<string, unknown> | null | undefined, appSettings: Record<string, unknown> | null | undefined) {
  const defaults = buildOwnerContactDefaults(appSettings);
  const propertyName = String(property?.ownerName || "").trim();
  const propertyEmail = String(property?.ownerEmail || "").trim();
  const propertyPhone = String(property?.ownerPhone || "").trim();
  return {
    ownerName: propertyName || defaults.ownerName || "Owner",
    ownerEmail: propertyEmail || defaults.ownerEmail,
    ownerPhone: propertyPhone || defaults.ownerPhone,
  };
}

export function formatStatementPresetLabel(preset: string) {
  if (preset === "ytd") return "Year to date";
  if (preset === "qtd") return "Quarter to date";
  if (preset === "mtd") return "Month to date";
  if (preset === "current-year") return "Current year";
  if (preset === "current-month") return "Current month";
  if (preset === "custom") return "Custom range";
  return "Annual";
}

export function buildOwnerStatementNoteTemplate(templateId: string, args: Record<string, unknown>) {
  const propertyScope = args.unitLabel && args.unitLabel !== "All units"
    ? `${args.propertyLabel} (${args.unitLabel})`
    : args.propertyLabel;
  const cashFlowLabel = currency(Number(args.totals?.cashFlow || 0));
  const incomeLabel = currency(Number(args.totals?.grossIncome || 0));

  if (templateId === "quarterly") {
    return `Please review the ${String(args.presetLabel || "").toLowerCase()} statement for ${propertyScope} covering ${args.periodLabel}. Gross income for the period was ${incomeLabel} and net cash flow was ${cashFlowLabel}. Let me know if you want a deeper breakdown on any repair, CapEx, or financing item.`;
  }
  if (templateId === "annual") {
    return `Attached is the ${String(args.presetLabel || "").toLowerCase()} owner statement for ${propertyScope}. This packet is intended to be tax-ready and summarizes the activity from ${args.periodLabel}. Gross income was ${incomeLabel} and net cash flow was ${cashFlowLabel}. Please review any notable repairs or capital items before filing.`;
  }
  if (templateId === "repairs") {
    return `Attached is the ${String(args.presetLabel || "").toLowerCase()} statement for ${propertyScope}. This period included heavier repair or maintenance activity, so I highlighted those items for quick review. Net cash flow for the statement period was ${cashFlowLabel}.`;
  }
  return `Attached is the ${String(args.presetLabel || "").toLowerCase()} owner statement for ${propertyScope} covering ${args.periodLabel}. Gross income for the period was ${incomeLabel} and net cash flow was ${cashFlowLabel}. Please let me know if you would like any backup detail added.`;
}

export function monthStartIso(dateText: unknown) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return "";
  const raw = String(dateText);
  return `${raw.slice(0, 7)}-01`;
}

export function quarterStartIso(dateText: unknown) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ""))) return "";
  const [year, month] = String(dateText).split("-").map(Number);
  const quarterMonth = Math.floor((month - 1) / 3) * 3 + 1;
  return `${String(year)}-${String(quarterMonth).padStart(2, "0")}-01`;
}

function statementPrintStyles() {
  return "body { font-family: Georgia, 'Times New Roman', serif; margin: 18px; color: #172033; }" +
    ".page { max-width: 960px; margin: 0 auto; }" +
    ".header { border-bottom: 2px solid #dbe4f0; padding-bottom: 14px; }" +
    ".header-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }" +
    ".header-copy { flex: 1; min-width: 0; }" +
    ".brand-block { min-width: 220px; max-width: 280px; text-align: right; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".brand-logo { max-width: 140px; max-height: 64px; object-fit: contain; margin-left: auto; margin-bottom: 10px; display: block; }" +
    ".brand-name { font-size: 15px; font-weight: 700; color: #172033; }" +
    ".brand-copy { margin-top: 4px; color: #607089; font-size: 11px; line-height: 1.45; }" +
    ".eyebrow { color: #5b6b83; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    "h1 { margin: 8px 0 0; font-size: 30px; line-height: 1.1; }" +
    ".subtitle { margin-top: 10px; color: #425066; font-size: 13px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".status-banner { margin-top: 14px; border-left: 4px solid #1d4ed8; background: #eff6ff; padding: 10px 12px; border-radius: 10px; font: 600 13px 'Segoe UI', Arial, sans-serif; color: #173a7a; }" +
    ".summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }" +
    ".summary-card { border: 1px solid #dbe4f0; border-radius: 12px; padding: 12px; background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%); break-inside: avoid; }" +
    ".summary-label { color: #5b6b83; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".summary-value { margin-top: 6px; font-size: 19px; font-weight: 700; }" +
    ".summary-subtext { margin-top: 4px; color: #607089; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".section { margin-top: 18px; border: 1px solid #dbe4f0; border-radius: 14px; overflow: hidden; break-inside: avoid; }" +
    ".section-header { padding: 12px 14px; background: #f8fafc; border-bottom: 1px solid #e5edf7; }" +
    ".section-title { margin: 0; font-size: 15px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".section-description { margin-top: 4px; color: #607089; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".section-body { padding: 0; }" +
    ".detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 14px; background: #ffffff; }" +
    ".detail-item { border: 1px solid #e5edf7; border-radius: 12px; padding: 10px 12px; background: #fcfdff; break-inside: avoid; }" +
    ".detail-label { color: #5b6b83; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".detail-value { margin-top: 5px; color: #172033; font-size: 13px; line-height: 1.5; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".note-box { padding: 14px; background: #fffdf5; color: #4b5563; font-size: 12px; line-height: 1.65; font-family: 'Segoe UI', Arial, sans-serif; white-space: pre-wrap; }" +
    ".pill-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 14px; background: #ffffff; }" +
    ".pill { border: 1px solid #dbe4f0; border-radius: 999px; padding: 6px 10px; background: #f8fbff; color: #425066; font: 600 11px 'Segoe UI', Arial, sans-serif; }" +
    ".table-wrap { overflow: hidden; }" +
    "table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }" +
    "thead { display: table-header-group; }" +
    "th, td { padding: 9px 10px; border-bottom: 1px solid #e7eef7; text-align: left; }" +
    "th { background: #f8fafc; color: #53627a; font: 600 11px 'Segoe UI', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.06em; }" +
    "tbody tr:nth-child(even) td { background: #f8fbfd; }" +
    "td { vertical-align: top; word-break: break-word; overflow-wrap: anywhere; }" +
    ".memo-col { width: 34%; }" +
    ".num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }" +
    ".statement-ledger-table { font-size: 11px; }" +
    ".statement-ledger-table th, .statement-ledger-table td { padding: 8px 6px; }" +
    ".statement-ledger-table .memo-col { width: auto; }" +
    ".statement-ledger-table .date-col { width: 12%; }" +
    ".statement-ledger-table .type-col { width: 12%; }" +
    ".statement-ledger-table .memo-width-col { width: 30%; }" +
    ".statement-ledger-table .charge-col { width: 14%; }" +
    ".statement-ledger-table .credit-col { width: 14%; }" +
    ".statement-ledger-table .balance-col { width: 18%; }" +
    ".positive { color: #166534; }" +
    ".negative { color: #b91c1c; }" +
    ".muted-copy { padding: 14px; color: #425066; font-size: 12px; line-height: 1.6; font-family: 'Segoe UI', Arial, sans-serif; }" +
    ".footer-note { margin-top: 16px; color: #607089; font-size: 11px; font-family: 'Segoe UI', Arial, sans-serif; }" +
    "@media print { body { margin: 10mm; } .section, .summary-card, .detail-item { break-inside: avoid; } }";
}

export function buildPrintableStatementHtml({
  title,
  subtitle,
  branding = null,
  bannerText = "",
  summaryCards = [],
  sections = [],
  footerNote = "",
}: {
  title: string;
  subtitle: string;
  branding?: { name?: string; addressLines?: string[]; contactLine?: string; logoDataUrl?: string } | null;
  bannerText?: string;
  summaryCards?: Array<{ label: string; value: string; subtext?: string }>;
  sections?: Array<{ title: string; description?: string; contentHtml: string }>;
  footerNote?: string;
}) {
  const cardsHtml = summaryCards
    .map((card) => `<div class="summary-card"><div class="summary-label">${escapeHtml(card.label)}</div><div class="summary-value">${escapeHtml(card.value)}</div>${card.subtext ? `<div class="summary-subtext">${escapeHtml(card.subtext)}</div>` : ""}</div>`)
    .join("");

  const brandingHtml = branding
    ? `<div class="brand-block">${branding.logoDataUrl ? `<img class="brand-logo" src="${escapeHtml(branding.logoDataUrl)}" alt="Statement logo" />` : ""}${branding.name ? `<div class="brand-name">${escapeHtml(branding.name)}</div>` : ""}${(branding.addressLines || []).map((line) => `<div class="brand-copy">${escapeHtml(line)}</div>`).join("")}${branding.contactLine ? `<div class="brand-copy">${escapeHtml(branding.contactLine)}</div>` : ""}</div>`
    : "";

  const sectionsHtml = sections
    .map((section) => `<section class="section"><div class="section-header"><h2 class="section-title">${escapeHtml(section.title)}</h2>${section.description ? `<div class="section-description">${escapeHtml(section.description)}</div>` : ""}</div><div class="section-body">${section.contentHtml}</div></section>`)
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><style>${statementPrintStyles()}</style></head><body><div class="page"><header class="header"><div class="header-top"><div class="header-copy"><div class="eyebrow">Rental Tracker Statement</div><h1>${escapeHtml(title)}</h1><div class="subtitle">${escapeHtml(subtitle)}</div></div>${brandingHtml}</div>${bannerText ? `<div class="status-banner">${escapeHtml(bannerText)}</div>` : ""}</header>${cardsHtml ? `<section class="summary-grid">${cardsHtml}</section>` : ""}${sectionsHtml}${footerNote ? `<div class="footer-note">${escapeHtml(footerNote)}</div>` : ""}</div></body></html>`;
}
