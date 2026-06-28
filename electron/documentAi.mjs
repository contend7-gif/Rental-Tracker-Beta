import { ipcMain } from "electron";

const DOCUMENT_AI_ANALYZE_CHANNEL = "document-ai:analyze";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_AI_MODEL = "gpt-4o-mini";

function sanitizeShortText(value, maxLength = 240) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeLongText(value, maxLength = 1600) {
  return String(value || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}

function sanitizeActionItems(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  value.forEach((item) => {
    const normalized = sanitizeShortText(item, 160);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(normalized);
  });
  return items.slice(0, 6);
}

function normalizeSuggestedAction(value) {
  const normalized = sanitizeShortText(value, 80).toLowerCase();
  return [
    "create_expense_draft",
    "create_work_order_draft",
    "attach_to_lease",
    "supporting_doc",
    "review_only",
  ].includes(normalized)
    ? normalized
    : "review_only";
}

function normalizeAiAnalysis(rawAnalysis, model) {
  if (!rawAnalysis || typeof rawAnalysis !== "object") return null;
  const analysis = rawAnalysis;
  const summary = sanitizeLongText(analysis.summary, 1500);
  if (!summary) return null;

  const totalAmount = Number(analysis.totalAmount);
  return {
    summary,
    actionItems: sanitizeActionItems(analysis.actionItems),
    suggestedAction: normalizeSuggestedAction(analysis.suggestedAction),
    suggestedActionReason: sanitizeLongText(analysis.suggestedActionReason, 400) || undefined,
    documentType: sanitizeShortText(analysis.documentType, 80) || undefined,
    vendorName: sanitizeShortText(analysis.vendorName, 120) || undefined,
    invoiceRef: sanitizeShortText(analysis.invoiceRef, 80) || undefined,
    invoiceDate: sanitizeShortText(analysis.invoiceDate, 40) || undefined,
    dueDate: sanitizeShortText(analysis.dueDate, 40) || undefined,
    totalAmount: Number.isFinite(totalAmount) ? totalAmount : undefined,
    propertyAddress: sanitizeShortText(analysis.propertyAddress, 180) || undefined,
    unit: sanitizeShortText(analysis.unit, 40) || undefined,
    serviceSummary: sanitizeLongText(analysis.serviceSummary, 240) || undefined,
    model: sanitizeShortText(model, 80) || DEFAULT_AI_MODEL,
    analyzedAt: new Date().toISOString(),
  };
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (Array.isArray(payload?.output)) {
    const parts = [];
    payload.output.forEach((item) => {
      if (!Array.isArray(item?.content)) return;
      item.content.forEach((contentItem) => {
        if (typeof contentItem?.text === "string" && contentItem.text.trim()) {
          parts.push(contentItem.text.trim());
        }
      });
    });
    if (parts.length > 0) return parts.join("\n");
  }

  return "";
}

function parseJsonObject(text) {
  const normalized = String(text || "").trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch {
    const start = normalized.indexOf("{");
    const end = normalized.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(normalized.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildDocumentAiInstructions() {
  return [
    "You are helping with rental-property document review inside a desktop app.",
    "Return only valid JSON.",
    "Summarize the document briefly, suggest the best next workflow step, and surface the most useful extracted fields.",
    "Do not invent facts that are not supported by the provided OCR text or linked context.",
    "If a field is unknown, return an empty string or null.",
    "Use one of these suggestedAction values: create_expense_draft, create_work_order_draft, attach_to_lease, supporting_doc, review_only.",
    "JSON shape:",
    "{",
    '  "summary": string,',
    '  "actionItems": string[],',
    '  "suggestedAction": string,',
    '  "suggestedActionReason": string,',
    '  "documentType": string,',
    '  "vendorName": string,',
    '  "invoiceRef": string,',
    '  "invoiceDate": string,',
    '  "dueDate": string,',
    '  "totalAmount": number | null,',
    '  "propertyAddress": string,',
    '  "unit": string,',
    '  "serviceSummary": string',
    "}",
  ].join("\n");
}

function buildDocumentAiUserPayload(payload) {
  const context = payload && typeof payload === "object" ? payload : {};
  return {
    document: context.document || {},
    property: context.property || null,
    lease: context.lease || null,
    transaction: context.transaction || null,
    workOrder: context.workOrder || null,
    extractedFields: context.extractedFields || null,
    tagSuggestions: Array.isArray(context.tagSuggestions) ? context.tagSuggestions : [],
    linkSuggestions: Array.isArray(context.linkSuggestions) ? context.linkSuggestions : [],
    expenseSuggestion: context.expenseSuggestion || null,
    workOrderSuggestion: context.workOrderSuggestion || null,
  };
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    return sanitizeLongText(payload?.error?.message || payload?.message || response.statusText, 600);
  } catch {
    return sanitizeLongText(response.statusText || "OpenAI request failed.", 600);
  }
}

export function registerDocumentAiIpc() {
  ipcMain.handle(DOCUMENT_AI_ANALYZE_CHANNEL, async (_event, rawPayload) => {
    const payload = rawPayload && typeof rawPayload === "object" ? rawPayload : {};
    const apiKey = sanitizeShortText(payload.apiKey, 240);
    const model = sanitizeShortText(payload.model, 80) || DEFAULT_AI_MODEL;
    const contextPayload = buildDocumentAiUserPayload(payload.context);
    const extractedText = sanitizeLongText(contextPayload?.document?.extractedText || "", 16000);

    if (!apiKey) {
      return { ok: false, reason: "missing-key", error: "Add an OpenAI API key in Settings first." };
    }
    if (!extractedText) {
      return { ok: false, reason: "missing-text", error: "Run OCR or enter indexed text before using AI on this document." };
    }

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        instructions: buildDocumentAiInstructions(),
        input: JSON.stringify(contextPayload),
        max_output_tokens: 900,
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "api-error",
        error: await readErrorMessage(response),
      };
    }

    const responsePayload = await response.json();
    const outputText = extractResponseText(responsePayload);
    const parsed = parseJsonObject(outputText);
    const analysis = normalizeAiAnalysis(parsed, model);

    if (!analysis) {
      return {
        ok: false,
        reason: "invalid-response",
        error: "AI returned an unreadable response. Try again or switch models in Settings.",
      };
    }

    return {
      ok: true,
      analysis,
    };
  });
}
