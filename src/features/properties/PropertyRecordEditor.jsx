import React, { useEffect, useRef, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { CalendarRange, Eye, EyeOff, FileText, TrendingUp } from "lucide-react";
import { field } from "../shared/uiHelpers.jsx";
import {
  DEFAULT_PROPERTY_DOCUMENT_TYPE,
  DEFAULT_PROPERTY_OPERATION_NOTE_CATEGORY,
  DEFAULT_PROPERTY_VALUATION_SOURCE,
  PROPERTY_DOCUMENT_TYPES,
  PROPERTY_OPERATION_NOTE_CATEGORIES,
  PROPERTY_VALUATION_SOURCES,
  estimatePropertyValueAtDate,
  operationNoteScopeLabel,
  projectPropertyValue,
} from "./propertyOperations.js";
import {
  SENSITIVE_NOTE_REVEAL_MS,
  buildUnitOccupancyTimeline,
  documentRenewalStatus,
  usefulPropertyDocumentTags,
} from "./propertyWorkspacePresentation.js";

const createOperationNoteDraft = (unit = "Shared") => ({
  id: "",
  title: "",
  category: DEFAULT_PROPERTY_OPERATION_NOTE_CATEGORY,
  unit,
  body: "",
  sensitive: false,
});

const createValuationDraft = (todayIso = "") => ({
  id: "",
  date: todayIso,
  value: "",
  source: DEFAULT_PROPERTY_VALUATION_SOURCE,
  documentId: "__none__",
  notes: "",
  setCurrentValue: true,
});

const createPropertyDocumentDraft = () => ({
  documentId: "__none__",
  type: DEFAULT_PROPERTY_DOCUMENT_TYPE,
});

const propertyDocumentTagForType = (type) =>
  String(type || DEFAULT_PROPERTY_DOCUMENT_TYPE)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const formatUnitName = (value) => (/^unit\b/i.test(String(value || "")) ? String(value) : `Unit ${value}`);

export function PropertyRecordEditor({
  actions,
  canCreateEditRecords,
  canDeleteRecords,
  currency,
  dashboardAsOfDate,
  documents = [],
  getUnitOccupancyPeriods,
  getUnitStatusForDate,
  leaseIsActiveByDate,
  leases,
  openLease,
  openDocumentImportPicker,
  openDocumentPreview,
  openLeaseForUnit,
  planningAssumptions,
  properties,
  propertyFilter,
  recordSection = "valuation",
  setPlanningAssumptions,
  setView,
  todayIso,
  unitStatusLabel,
  units,
  yearFilter,
}) {
  const visibleProperties = propertyFilter === "all" ? properties : properties.filter((property) => property.id === propertyFilter);
  const [operationNoteDrafts, setOperationNoteDrafts] = useState({});
  const [valuationDrafts, setValuationDrafts] = useState({});
  const [propertyDocumentDrafts, setPropertyDocumentDrafts] = useState({});
  const [revealedSensitiveNoteIds, setRevealedSensitiveNoteIds] = useState(() => new Set());
  const sensitiveRevealTimersRef = useRef(new Map());

  useEffect(() => {
    setRevealedSensitiveNoteIds(new Set());
    sensitiveRevealTimersRef.current.forEach((timer) => clearTimeout(timer));
    sensitiveRevealTimersRef.current.clear();
    return () => {
      sensitiveRevealTimersRef.current.forEach((timer) => clearTimeout(timer));
      sensitiveRevealTimersRef.current.clear();
    };
  }, [propertyFilter, recordSection]);

  const setSensitiveNoteRevealed = (property, note, revealed) => {
    const existingTimer = sensitiveRevealTimersRef.current.get(note.id);
    if (existingTimer) clearTimeout(existingTimer);
    sensitiveRevealTimersRef.current.delete(note.id);
    setRevealedSensitiveNoteIds((previous) => {
      const next = new Set(previous);
      if (revealed) next.add(note.id);
      else next.delete(note.id);
      return next;
    });
    if (!revealed) return;
    actions.addActivityLogEntry?.({
      action: "reveal",
      entityType: "property-operation-note",
      entityId: note.id,
      propertyId: property.id,
      unit: note.unit,
      summary: "Sensitive operations note revealed.",
      details: note.title,
      category: "security",
    });
    const timer = setTimeout(() => {
      setRevealedSensitiveNoteIds((previous) => {
        const next = new Set(previous);
        next.delete(note.id);
        return next;
      });
      sensitiveRevealTimersRef.current.delete(note.id);
    }, SENSITIVE_NOTE_REVEAL_MS);
    sensitiveRevealTimersRef.current.set(note.id, timer);
  };
  const getOperationNoteDraft = (propertyId) => operationNoteDrafts[propertyId] || createOperationNoteDraft();
  const setOperationNoteDraft = (propertyId, patch) => {
    setOperationNoteDrafts((prev) => ({
      ...prev,
      [propertyId]: { ...getOperationNoteDraft(propertyId), ...patch },
    }));
  };
  const resetOperationNoteDraft = (propertyId) => {
    setOperationNoteDrafts((prev) => ({ ...prev, [propertyId]: createOperationNoteDraft() }));
  };
  const editOperationNote = (propertyId, note) => {
    setOperationNoteDrafts((prev) => ({
      ...prev,
      [propertyId]: {
        id: note.id,
        title: note.title || "",
        category: note.category || DEFAULT_PROPERTY_OPERATION_NOTE_CATEGORY,
        unit: note.unit || "Shared",
        body: note.body || "",
        sensitive: Boolean(note.sensitive),
      },
    }));
  };
  const saveOperationNote = (propertyId) => {
    const draft = getOperationNoteDraft(propertyId);
    if (!String(draft.title || "").trim() && !String(draft.body || "").trim()) return;
    actions.upsertPropertyOperationNote(propertyId, draft);
    resetOperationNoteDraft(propertyId);
  };
  const getValuationDraft = (propertyId) => valuationDrafts[propertyId] || createValuationDraft(todayIso);
  const setValuationDraft = (propertyId, patch) => {
    setValuationDrafts((prev) => ({
      ...prev,
      [propertyId]: { ...getValuationDraft(propertyId), ...patch },
    }));
  };
  const resetValuationDraft = (propertyId) => {
    setValuationDrafts((prev) => ({ ...prev, [propertyId]: createValuationDraft(todayIso) }));
  };
  const editValuation = (propertyId, valuation) => {
    setValuationDrafts((prev) => ({
      ...prev,
      [propertyId]: {
        id: valuation.id,
        date: valuation.date || todayIso,
        value: valuation.value != null ? String(valuation.value) : "",
        source: valuation.source || DEFAULT_PROPERTY_VALUATION_SOURCE,
        documentId: valuation.documentId || "__none__",
        notes: valuation.notes || "",
        setCurrentValue: false,
      },
    }));
  };
  const saveValuation = (propertyId) => {
    const draft = getValuationDraft(propertyId);
    const value = Number(draft.value || 0);
    if (!Number.isFinite(value) || value <= 0) return;
    actions.upsertPropertyValuation(propertyId, {
      id: draft.id || undefined,
      date: draft.date || todayIso,
      value,
      source: draft.source,
      documentId: draft.documentId === "__none__" ? "" : draft.documentId,
      notes: draft.notes,
    }, { setCurrentValue: draft.setCurrentValue });
    resetValuationDraft(propertyId);
  };
  const getPropertyDocumentDraft = (propertyId) => propertyDocumentDrafts[propertyId] || createPropertyDocumentDraft();
  const setPropertyDocumentDraft = (propertyId, patch) => {
    setPropertyDocumentDrafts((prev) => ({
      ...prev,
      [propertyId]: { ...getPropertyDocumentDraft(propertyId), ...patch },
    }));
  };
  const resetPropertyDocumentDraft = (propertyId) => {
    setPropertyDocumentDrafts((prev) => ({ ...prev, [propertyId]: createPropertyDocumentDraft() }));
  };
  const attachPropertyDocument = (propertyId) => {
    const draft = getPropertyDocumentDraft(propertyId);
    const document = documents.find((item) => item.id === draft.documentId);
    if (!document) return;
    const type = draft.type || DEFAULT_PROPERTY_DOCUMENT_TYPE;
    const tags = Array.from(new Set([...(document.tags || []), "property", propertyDocumentTagForType(type)].filter(Boolean)));
    actions.updateDocument(document.id, {
      propertyId,
      unit: "Shared",
      type,
      tags,
    });
    resetPropertyDocumentDraft(propertyId);
  };
  const uploadPropertyDocument = (propertyId, type = DEFAULT_PROPERTY_DOCUMENT_TYPE) => {
    openDocumentImportPicker?.({
      propertyId,
      unit: "Shared",
      type,
      tags: `property, ${propertyDocumentTagForType(type)}`,
    });
  };
  const annualAppreciationPct = Number(planningAssumptions?.annualValueGrowthPct || 0);
  const planningHorizonMonths = Math.max(1, Math.round(Number(planningAssumptions?.horizonMonths || 12)));

  return (
    <div className="space-y-3">
        {recordSection === "valuation" ? <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Planning appreciation rate</div>
              <div className="mt-1 text-xs text-slate-600">
                Used to roll supported valuations forward for current estimates and planning projections.
              </div>
            </div>
            <div className="w-full sm:w-44">
              <label className="text-xs font-medium text-slate-600">Annual appreciation %</label>
              <Input
                className="mt-1 bg-white"
                type="number"
                step="0.1"
                value={planningAssumptions?.annualValueGrowthPct ?? ""}
                onChange={(event) => setPlanningAssumptions?.((prev) => ({ ...prev, annualValueGrowthPct: event.target.value }))}
              />
            </div>
          </div>
        </div> : null}
        {visibleProperties.map((property) => {
          const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
          const propertyDocuments = documents
            .filter((document) =>
              document.propertyId === property.id &&
              !document.transactionId &&
              !document.leaseId &&
              !document.workOrderId &&
              (!Array.isArray(document.relatedTransactionIds) || document.relatedTransactionIds.length === 0)
            )
            .sort((left, right) => String(right.uploadedAt || "").localeCompare(String(left.uploadedAt || "")));
          const attachableDocuments = documents
            .filter((document) => document.id && document.propertyId !== property.id)
            .sort((left, right) => String(right.uploadedAt || "").localeCompare(String(left.uploadedAt || "")))
            .slice(0, 200);
          const latestValuation = (property.propertyValuations || [])[0];
          const manualCurrentValue = Number(property.currentValue || property.purchasePrice || 0);
          const supportedValue = Number(latestValuation?.value || manualCurrentValue || 0);
          const valuationDate = latestValuation?.date || property.purchasedOn || todayIso;
          const estimatedCurrentValue = estimatePropertyValueAtDate(supportedValue, annualAppreciationPct, valuationDate, todayIso);
          const projectedValue = projectPropertyValue(estimatedCurrentValue, annualAppreciationPct, planningHorizonMonths);
          const valuationDraft = getValuationDraft(property.id);
          const propertyDocumentDraft = getPropertyDocumentDraft(property.id);
          return (
            <div key={property.id} className="space-y-3">
              {recordSection === "valuation" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                    <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">Valuation and appreciation support</div>
                    <div className="text-xs text-slate-500">
                      Current estimate rolls the latest support forward with the planning appreciation rate.
                    </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-3">
                  <div className="bg-white p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Current estimate</div><div className="mt-1 text-base font-semibold text-slate-950">{estimatedCurrentValue > 0 ? currency(estimatedCurrentValue) : "Not set"}</div><div className="text-[11px] text-slate-500">Rolled forward through {todayIso}</div></div>
                  <div className="bg-white p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Base support</div><div className="mt-1 text-base font-semibold text-slate-950">{supportedValue > 0 ? currency(supportedValue) : "Not set"}</div><div className="text-[11px] text-slate-500">{latestValuation ? `${latestValuation.source} | ${latestValuation.date}` : "Manual value basis"}</div></div>
                  <div className="bg-white p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Planning projection</div><div className="mt-1 text-base font-semibold text-slate-950">{projectedValue > 0 ? currency(projectedValue) : "Not available"}</div><div className="text-[11px] text-slate-500">{planningHorizonMonths} months at {annualAppreciationPct || 0}% / year</div></div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-3 border-b border-slate-100 pb-2"><div className="text-sm font-semibold text-slate-900">{valuationDraft.id ? "Edit valuation" : "Add valuation support"}</div><div className="text-xs text-slate-500">Record the dated source behind a value estimate. Supporting documents remain linked in the history below.</div></div>
                  <div className="grid gap-2 md:grid-cols-[140px_150px_180px_1fr]">
                    {field(
                      "Date",
                      <Input
                        type="date"
                        value={valuationDraft.date}
                        onChange={(event) => setValuationDraft(property.id, { date: event.target.value })}
                      />,
                    )}
                    {field(
                      "Value",
                      <Input
                        type="number"
                        value={valuationDraft.value}
                        placeholder={supportedValue > 0 ? String(supportedValue) : "0"}
                        onChange={(event) => setValuationDraft(property.id, { value: event.target.value })}
                      />,
                    )}
                    {field(
                      "Source",
                      <Select value={valuationDraft.source} onValueChange={(value) => setValuationDraft(property.id, { source: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_VALUATION_SOURCES.map((source) => (
                            <SelectItem key={`valuation-source-${property.id}-${source}`} value={source}>{source}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                    )}
                    {field(
                      "Supporting document",
                      <Select value={valuationDraft.documentId || "__none__"} onValueChange={(value) => setValuationDraft(property.id, { documentId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No linked document</SelectItem>
                          {propertyDocuments.map((document) => (
                            <SelectItem key={`valuation-doc-${property.id}-${document.id}`} value={document.id}>
                              {document.name || document.type || "Document"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                    {field(
                      "Notes",
                      <Input
                        value={valuationDraft.notes}
                        placeholder="Appraisal, assessment notice, refinance estimate..."
                        onChange={(event) => setValuationDraft(property.id, { notes: event.target.value })}
                      />,
                    )}
                    <label className="mt-6 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={valuationDraft.setCurrentValue}
                        onChange={(event) => setValuationDraft(property.id, { setCurrentValue: event.target.checked })}
                      />
                      Update manual value basis
                    </label>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => saveValuation(property.id)} disabled={!canCreateEditRecords || Number(valuationDraft.value || 0) <= 0}>
                      {valuationDraft.id ? "Update valuation" : "Add valuation"}
                    </Button>
                    {valuationDraft.id ? (
                      <Button size="sm" variant="secondary" onClick={() => resetValuationDraft(property.id)}>
                        Cancel edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Valuation history</div><div className="text-xs text-slate-500">Dated support used for estimates and planning.</div></div><Badge variant="secondary">{(property.propertyValuations || []).length}</Badge></div>
                {(property.propertyValuations || []).length === 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    No valuation history yet. Add the purchase appraisal, assessment, refinance estimate, or your current manual estimate here.
                  </div>
                ) : (
                  <div className="mt-2 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {(property.propertyValuations || []).map((valuation) => {
                      const linkedDocument = valuation.documentId ? documents.find((document) => document.id === valuation.documentId) : null;
                      return (
                        <div key={valuation.id} className="p-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><div className="font-semibold text-slate-950">{currency(Number(valuation.value || 0))}</div><div className="text-xs font-medium text-slate-600">{valuation.date}</div><Badge variant="secondary">{valuation.source}</Badge></div>
                              <div className="mt-1 text-xs text-slate-500">Support: {linkedDocument ? linkedDocument.name : "No linked document"}</div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {linkedDocument ? (
                                <Button size="sm" variant="secondary" onClick={() => openDocumentPreview?.(linkedDocument)} disabled={!linkedDocument.dataUrl}>
                                  View doc
                                </Button>
                              ) : null}
                              <Button size="sm" variant="secondary" onClick={() => editValuation(property.id, valuation)} disabled={!canCreateEditRecords}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => actions.deletePropertyValuation(property.id, valuation.id)}
                                disabled={!canDeleteRecords}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                          {valuation.notes ? <div className="mt-2 border-l-2 border-slate-200 pl-2 text-xs text-slate-600">{valuation.notes}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                )}
                {latestValuation ? (
                  <div className="mt-2 text-[11px] text-slate-500">
                    Latest support: {latestValuation.source} on {latestValuation.date}. Current estimate rolls forward through {todayIso}. The planning projection is not a market valuation.
                  </div>
                ) : null}
              </div> : null}

              {recordSection === "documents" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                    <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">Property document vault</div>
                    <div className="text-xs text-slate-500">
                      Attach closing statements, deeds, appraisals, inspections, tax assessments, insurance declarations, and refinance packets to this property.
                    </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {propertyDocuments.length} document{propertyDocuments.length === 1 ? "" : "s"}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => setView?.("documents")}>
                      Open Documents
                    </Button>
                    <Button size="sm" onClick={() => uploadPropertyDocument(property.id, propertyDocumentDraft.type || DEFAULT_PROPERTY_DOCUMENT_TYPE)} disabled={!canCreateEditRecords}>
                      Upload property document
                    </Button>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                    {field(
                      "Existing document",
                      <Select value={propertyDocumentDraft.documentId} onValueChange={(value) => setPropertyDocumentDraft(property.id, { documentId: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Choose document</SelectItem>
                          {attachableDocuments.map((document) => (
                            <SelectItem key={`attach-property-doc-${property.id}-${document.id}`} value={document.id}>
                              {document.name || document.type || document.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                    )}
                    {field(
                      "Document type",
                      <Select value={propertyDocumentDraft.type} onValueChange={(value) => setPropertyDocumentDraft(property.id, { type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROPERTY_DOCUMENT_TYPES.map((type) => (
                            <SelectItem key={`property-doc-type-${property.id}-${type}`} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>,
                    )}
                    <div className="mt-6">
                      <Button
                        size="sm"
                        onClick={() => attachPropertyDocument(property.id)}
                        disabled={!canCreateEditRecords || propertyDocumentDraft.documentId === "__none__"}
                      >
                        Attach to property
                      </Button>
                    </div>
                  </div>
                  {attachableDocuments.length === 0 ? (
                    <div className="mt-2 text-xs text-slate-500">
                      Upload documents in Documents first, then attach them here as property support.
                    </div>
                  ) : null}
                </div>

                {propertyDocuments.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    No property-level documents linked yet.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {propertyDocuments.map((document) => {
                      const usefulTags = usefulPropertyDocumentTags(document);
                      const scopeLabel = !document.unit || document.unit === "Shared" ? property.name : `${property.name} | ${formatUnitName(document.unit)}`;
                      const renewalStatus = documentRenewalStatus(document.expiresOn, dashboardAsOfDate);
                      return <div key={document.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex min-w-0 flex-1 items-start gap-2.5">
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500"><FileText className="h-4 w-4" /></span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-slate-900">{document.name || "Document"}</div>
                              <div className="mt-0.5 text-xs text-slate-500">{document.type || "Property document"} | {document.uploadedAt ? String(document.uploadedAt).slice(0, 10) : "Date not recorded"}</div>
                              <div className="mt-0.5 truncate text-xs text-slate-500" title={scopeLabel}>{scopeLabel}</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {document.expiresOn ? <Badge variant="secondary" className={renewalStatus.key === "expired" ? "!bg-rose-100 !text-rose-800" : renewalStatus.key === "due-soon" ? "!bg-amber-100 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>{renewalStatus.label}</Badge> : null}
                                {usefulTags.map((tag) => <Badge key={`${document.id}-${tag}`} variant="secondary">{tag}</Badge>)}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openDocumentPreview?.(document)}
                              disabled={!document.dataUrl}
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => actions.updateDocument(document.id, { propertyId: "", unit: "" })}
                              disabled={!canCreateEditRecords}
                            >
                              Unlink
                            </Button>
                          </div>
                        </div>
                        <label className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 text-xs font-medium text-slate-600">
                          Renewal or expiration
                          <Input className="h-8 w-40 bg-white" type="date" value={document.expiresOn || ""} onInput={(event) => actions.updateDocument(document.id, { expiresOn: event.currentTarget.value })} disabled={!canCreateEditRecords} />
                          {!document.expiresOn ? <span className="font-normal text-slate-400">Optional</span> : null}
                        </label>
                      </div>;
                    })}
                  </div>
                )}
              </div> : null}

              {recordSection === "notes" ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">Property operations notes</div>
                    <div className="text-xs text-slate-500">
                      Store property-level and unit-level memory like access codes, shutoffs, appliance details, utility notes, and tenant handoff instructions.
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {(property.operationNotes || []).length} note{(property.operationNotes || []).length === 1 ? "" : "s"}
                  </Badge>
                </div>

                {(() => {
                  const draft = getOperationNoteDraft(property.id);
                  const operationNoteUnitOptions = ["Shared", ...propertyUnits.map((unit) => unit.name)];
                  return (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_160px_150px_auto]">
                        {field(
                          "Title",
                          <Input
                            value={draft.title}
                            placeholder="Front door code, water shutoff, filter size..."
                            onChange={(e) => setOperationNoteDraft(property.id, { title: e.target.value })}
                          />,
                        )}
                        {field(
                          "Category",
                          <Select value={draft.category} onValueChange={(value) => setOperationNoteDraft(property.id, { category: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROPERTY_OPERATION_NOTE_CATEGORIES.map((category) => (
                                <SelectItem key={`operation-category-${property.id}-${category}`} value={category}>{category}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>,
                        )}
                        {field(
                          "Scope",
                          <Select value={draft.unit || "Shared"} onValueChange={(value) => setOperationNoteDraft(property.id, { unit: value })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {operationNoteUnitOptions.map((unitName) => (
                                <SelectItem key={`operation-unit-${property.id}-${unitName}`} value={unitName}>
                                  {unitName === "Shared" ? "Property" : formatUnitName(unitName)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>,
                        )}
                        <label className="mt-6 flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={draft.sensitive}
                            onChange={(e) => setOperationNoteDraft(property.id, { sensitive: e.target.checked })}
                          />
                          Sensitive
                        </label>
                      </div>
                      <div className="mt-2">
                        <label className="text-xs font-medium text-slate-600">Note</label>
                        <textarea
                          className="mt-1 h-20 w-full rounded-md border border-slate-200 p-2 text-sm"
                          value={draft.body}
                          placeholder="Keep the actual code, reset steps, location, or operational instruction here."
                          onChange={(e) => setOperationNoteDraft(property.id, { body: e.target.value })}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => saveOperationNote(property.id)} disabled={!canCreateEditRecords || (!draft.title.trim() && !draft.body.trim())}>
                          {draft.id ? "Update note" : "Add note"}
                        </Button>
                        {draft.id ? (
                          <Button size="sm" variant="secondary" onClick={() => resetOperationNoteDraft(property.id)}>
                            Cancel edit
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}

                {(property.operationNotes || []).length === 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    No property operations notes yet.
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {(property.operationNotes || []).map((note) => (
                      <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-900">{note.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge variant="secondary">{note.category}</Badge>
                              <Badge variant="secondary">{operationNoteScopeLabel(note)}</Badge>
                              {note.sensitive ? <Badge variant="secondary" className="!bg-amber-100 !text-amber-800">Sensitive</Badge> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {note.sensitive && note.body ? (
                              <Button size="sm" variant="secondary" onClick={() => setSensitiveNoteRevealed(property, note, !revealedSensitiveNoteIds.has(note.id))}>
                                {revealedSensitiveNoteIds.has(note.id) ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                                {revealedSensitiveNoteIds.has(note.id) ? "Hide" : "Reveal for 60s"}
                              </Button>
                            ) : null}
                            <Button size="sm" variant="secondary" onClick={() => editOperationNote(property.id, note)} disabled={!canCreateEditRecords}>
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => actions.deletePropertyOperationNote(property.id, note.id)}
                              disabled={!canDeleteRecords}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                        {note.body && (!note.sensitive || revealedSensitiveNoteIds.has(note.id)) ? <div className={`mt-2 whitespace-pre-wrap rounded-md px-2.5 py-2 text-xs ${note.sensitive ? "border border-amber-200 bg-amber-50 text-slate-800" : "bg-slate-50 text-slate-600"}`}>{note.body}</div> : null}
                        {note.sensitive && note.body && !revealedSensitiveNoteIds.has(note.id) ? <div className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-amber-200 bg-amber-50/60 px-2.5 py-2 text-xs text-amber-800"><EyeOff className="h-3.5 w-3.5 shrink-0" />Sensitive content hidden. Reveals automatically close after 60 seconds.</div> : null}
                        <div className="mt-2 text-[11px] text-slate-400">Updated {String(note.updatedAt || "").slice(0, 10)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div> : null}

              {recordSection === "occupancy" ? <div className="space-y-2">
                {propertyUnits.length === 0 ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No units are attached to this property yet.</div> : propertyUnits.map((unit) => {
                  const unitStatus = getUnitStatusForDate(unit, dashboardAsOfDate);
                  const activeLease = leases.find(
                    (lease) => lease.propertyId === property.id && lease.unit === unit.name && leaseIsActiveByDate(lease, dashboardAsOfDate),
                  );
                  const occupancyPeriods = getUnitOccupancyPeriods(property.id, unit.name);
                  const unitLeases = leases.filter((lease) => lease.propertyId === property.id && lease.unit === unit.name);
                  const occupancyTimeline = buildUnitOccupancyTimeline(unit.name, occupancyPeriods, unitLeases);
                  const leaseSummaryLabel = yearFilter === todayIso.slice(0, 4) ? "Active lease" : `Lease as of ${dashboardAsOfDate}`;

                  return (
                    <div key={unit.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-semibold text-slate-900">{formatUnitName(unit.name)}</div>
                            <Badge variant="secondary">{unitStatusLabel[unitStatus] || unitStatus}</Badge>
                          </div>
                          {activeLease ? (
                            <div className="text-xs text-slate-500">
                              {leaseSummaryLabel}: {activeLease.tenantName} ({activeLease.endDate})
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">No active lease</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {activeLease ? (
                            <Button size="sm" variant="secondary" className="h-10 px-4" onClick={() => openLease(activeLease)}>
                              View lease
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" className="h-10 px-4" onClick={() => openLeaseForUnit(property.id, unit.name)}>
                              Manage occupancy
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase text-slate-500"><CalendarRange className="h-3.5 w-3.5" />Occupancy history</div>
                        {occupancyTimeline.length ? <div className="divide-y divide-slate-100">{occupancyTimeline.slice(0, 5).map((entry) => (
                          <div key={entry.id} className="grid gap-1 py-1.5 text-xs sm:grid-cols-[12px_minmax(0,1fr)_190px] sm:items-center">
                            <span className={`h-2 w-2 rounded-full ${entry.kind === "lease" ? "bg-teal-500" : entry.kind === "vacancy" ? "bg-amber-400" : "bg-slate-400"}`} />
                            <span className="min-w-0"><span className="font-medium text-slate-800">{entry.label}</span><span className="ml-2 text-slate-400">{entry.detail}</span></span>
                            <span className="text-slate-500 sm:text-right">{entry.startDate || "Date not set"} to {entry.endDate || "Present"}</span>
                          </div>
                        ))}{occupancyTimeline.length > 5 ? <div className="py-1.5 text-[11px] text-slate-400">{occupancyTimeline.length - 5} earlier period{occupancyTimeline.length - 5 === 1 ? "" : "s"} not shown</div> : null}</div> : <div className="text-xs text-slate-500">No occupancy or lease history recorded.</div>}
                      </div>
                    </div>
                  );
                })}
              </div> : null}
            </div>
          );
        })}
    </div>
  );
}
