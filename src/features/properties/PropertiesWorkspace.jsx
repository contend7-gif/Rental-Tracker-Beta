import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  ClipboardPlus,
  CircleDollarSign,
  FileText,
  History,
  ImagePlus,
  Info,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { isRentIncomeTransaction } from "../transactions/transactionPresentation.js";
import { PropertyRecordEditor } from "./PropertyRecordEditor.jsx";
import { estimatePropertyValueAtDate } from "./propertyOperations.js";
import {
  PROPERTY_PHOTO_CATEGORIES,
  VISIBLE_RENT_SCHEDULE_HELP,
  buildUnitOccupancyTimeline,
  documentRenewalStatus,
  propertyActivityEntries,
  readinessRecordSection,
} from "./propertyWorkspacePresentation.js";

const CLOSED_WORK_ORDER_STATUSES = new Set(["Completed", "Closed", "Canceled"]);

function monthCountForLease(lease, year, asOfDate) {
  const endMonth = Number(String(asOfDate).slice(5, 7)) || 12;
  let count = 0;
  for (let month = 1; month <= endMonth; month += 1) {
    const dueDay = Math.max(1, Math.min(28, Number(lease.rentDueDay || 1)));
    const date = `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
    const effectiveEnd = lease.actualEndDate || lease.endDate || "9999-12-31";
    if (date <= asOfDate && date >= lease.startDate && date <= effectiveEnd) count += 1;
  }
  return count;
}

function resizePropertyImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Unable to decode image."));
      image.onload = () => {
        const maxDimension = 1600;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function PropertyThumb({ property, className = "h-12 w-16" }) {
  const cover = (property.photos || []).find((photo) => photo.isCover) || property.photos?.[0];
  if (cover?.dataUrl) {
    return <img src={cover.dataUrl} alt="" className={`${className} shrink-0 rounded-md object-cover`} />;
  }
  return (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-400`}>
      <Building2 className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}

function Stat({ label, value, detail, tone = "text-slate-950" }) {
  return (
    <div className="min-w-0 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4 lg:last:border-r-0 lg:last:pr-0">
      <div className="text-[11px] font-medium uppercase text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-base font-semibold ${tone}`}>{value}</div>
      {detail ? <div className="mt-0.5 truncate text-xs text-slate-500">{detail}</div> : null}
    </div>
  );
}

function PropertyActivityIcon({ entry }) {
  const type = String(entry?.entityType || "");
  if (entry?.action === "archive") return <Archive className="h-4 w-4" />;
  if (entry?.action === "restore") return <RotateCcw className="h-4 w-4" />;
  if (type.includes("document")) return <FileText className="h-4 w-4" />;
  if (type.includes("operation-note")) return <KeyRound className="h-4 w-4" />;
  if (type.includes("valuation")) return <TrendingUp className="h-4 w-4" />;
  if (type === "unit") return <Building2 className="h-4 w-4" />;
  return <History className="h-4 w-4" />;
}

export function PropertiesWorkspace(props) {
  const {
    actions,
    activityLog = [],
    canCreateEditRecords,
    canDeleteRecords,
    currency,
    dashboardAsOfDate,
    documents = [],
    getUnitStatusForDate,
    getUnitOccupancyPeriods,
    leaseIsActiveByDate,
    leases = [],
    openLease,
    openLeaseForUnit,
    openNewLeaseForUnit,
    openDashboardQuickAddForScope,
    openDocumentImportPicker,
    properties = [],
    propertyFilter,
    planningAssumptions,
    setPropertyFilter,
    setUnitFilter,
    setView,
    setWorkOrderDraft,
    transactions = [],
    unitStatusLabel = {},
    units = [],
    workOrders = [],
    yearFilter,
    todayIso,
  } = props;
  const requestedProperties = propertyFilter === "all" ? properties : properties.filter((property) => property.id === propertyFilter);
  const archivedPropertyCount = requestedProperties.filter((property) => property.archivedAt).length;
  const [showArchived, setShowArchived] = useState(false);
  const scopedProperties = requestedProperties.filter((property) => showArchived || !property.archivedAt);
  const [selectedPropertyId, setSelectedPropertyId] = useState(() => scopedProperties[0]?.id || "");
  const [tab, setTab] = useState("overview");
  const [recordSection, setRecordSection] = useState("valuation");
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [unitEditorOpen, setUnitEditorOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState({ id: "", name: "", status: "Vacant" });
  const [leasePickerOpen, setLeasePickerOpen] = useState(false);
  const [leaseUnit, setLeaseUnit] = useState("");
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [photoDraft, setPhotoDraft] = useState(null);
  const [photoToRemove, setPhotoToRemove] = useState(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [unitDetailId, setUnitDetailId] = useState("");
  const photoInputRef = useRef(null);

  useEffect(() => {
    if (!scopedProperties.some((property) => property.id === selectedPropertyId)) {
      setSelectedPropertyId(scopedProperties[0]?.id || "");
    }
  }, [scopedProperties, selectedPropertyId]);

  const rows = useMemo(() => scopedProperties.map((property) => {
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const rentableUnits = propertyUnits.filter((unit) => getUnitStatusForDate(unit, dashboardAsOfDate) !== "Owner-Occupied");
    const occupiedUnits = rentableUnits.filter((unit) => getUnitStatusForDate(unit, dashboardAsOfDate) === "Rental");
    const propertyTransactions = transactions.filter((transaction) =>
      transaction.propertyId === property.id &&
      transaction.status !== "voided" &&
      String(transaction.date || "").startsWith(String(yearFilter)) &&
      transaction.date <= dashboardAsOfDate
    );
    const income = propertyTransactions.filter((transaction) => transaction.type === "Income").reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const expenses = propertyTransactions.filter((transaction) => transaction.type === "Expense").reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const rentRecorded = propertyTransactions.filter(isRentIncomeTransaction).reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const propertyLeases = leases.filter((lease) => lease.propertyId === property.id);
    const scheduledRent = propertyLeases.reduce((sum, lease) => sum + Number(lease.monthlyRent || 0) * monthCountForLease(lease, yearFilter, dashboardAsOfDate), 0);
    const nextLease = propertyLeases
      .filter((lease) => leaseIsActiveByDate(lease, dashboardAsOfDate) && (lease.actualEndDate || lease.endDate) >= dashboardAsOfDate)
      .sort((left, right) => String(left.actualEndDate || left.endDate).localeCompare(String(right.actualEndDate || right.endDate)))[0];
    const openReviewItems = propertyTransactions.filter((transaction) => transaction.taxChecked === false).length;
    const openMaintenance = workOrders.filter((order) => order.propertyId === property.id && !CLOSED_WORK_ORDER_STATUSES.has(order.status)).length;
    return {
      property,
      units: propertyUnits,
      rentableUnits,
      occupiedUnits,
      occupancy: rentableUnits.length ? occupiedUnits.length / rentableUnits.length : null,
      income,
      expenses,
      cashflow: income - expenses,
      rentRecorded,
      scheduledRent,
      nextLease,
      openItems: openReviewItems + openMaintenance,
      openReviewItems,
      openMaintenance,
      documentCount: documents.filter((document) => document.propertyId === property.id).length,
      propertyDocumentCount: documents.filter((document) =>
        document.propertyId === property.id &&
        !document.transactionId &&
        !document.leaseId &&
        !document.workOrderId &&
        (!Array.isArray(document.relatedTransactionIds) || document.relatedTransactionIds.length === 0)
      ).length,
    };
  }), [dashboardAsOfDate, documents, getUnitStatusForDate, leaseIsActiveByDate, leases, scopedProperties, transactions, units, workOrders, yearFilter]);

  const selected = rows.find((row) => row.property.id === selectedPropertyId) || rows[0];
  const unitDetail = selected?.units.find((unit) => unit.id === unitDetailId) || null;
  const unitDetailStatus = unitDetail ? getUnitStatusForDate(unitDetail, dashboardAsOfDate) : "";
  const unitDetailLease = unitDetail && selected ? leases.find((lease) => (
    lease.propertyId === selected.property.id &&
    lease.unit === unitDetail.name &&
    leaseIsActiveByDate(lease, dashboardAsOfDate)
  )) : null;
  const unitDetailTransactions = unitDetail && selected ? transactions.filter((transaction) => (
    transaction.propertyId === selected.property.id &&
    transaction.unit === unitDetail.name &&
    transaction.status !== "voided" &&
    String(transaction.date || "").startsWith(String(yearFilter)) &&
    transaction.date <= dashboardAsOfDate
  )) : [];
  const unitDetailRent = unitDetailTransactions
    .filter(isRentIncomeTransaction)
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const unitDetailMaintenance = unitDetail && selected ? workOrders.filter((order) => (
    order.propertyId === selected.property.id &&
    order.unit === unitDetail.name &&
    !CLOSED_WORK_ORDER_STATUSES.has(order.status)
  )) : [];
  const unitDetailDocuments = unitDetail && selected ? documents.filter((document) => (
    document.propertyId === selected.property.id && document.unit === unitDetail.name
  )) : [];
  const unitDetailPhotos = unitDetail && selected ? (selected.property.photos || []).filter((photo) => photo.unit === unitDetail.name) : [];
  const unitDetailTimeline = unitDetail && selected ? buildUnitOccupancyTimeline(
    unitDetail.name,
    getUnitOccupancyPeriods?.(selected.property.id, unitDetail.name) || [],
    leases.filter((lease) => lease.propertyId === selected.property.id),
  ) : [];
  const selectedActivities = useMemo(
    () => propertyActivityEntries(activityLog, selected?.property.id, 8),
    [activityLog, selected?.property.id],
  );
  const selectedValueSummary = useMemo(() => {
    const property = selected?.property;
    if (!property) return { value: 0, detail: "Not set" };
    const latestValuation = (property.propertyValuations || [])[0];
    const baseValue = Number(latestValuation?.value || property.currentValue || property.purchasePrice || 0);
    const valuationDate = latestValuation?.date || property.purchasedOn || todayIso || dashboardAsOfDate;
    const asOfDate = todayIso || dashboardAsOfDate;
    const annualAppreciationPct = Number(planningAssumptions?.annualValueGrowthPct || 0);
    const estimatedValue = estimatePropertyValueAtDate(baseValue, annualAppreciationPct, valuationDate, asOfDate);
    if (estimatedValue <= 0) return { value: 0, detail: "Add valuation support" };
    const supportLabel = latestValuation
      ? `${latestValuation.source} ${latestValuation.date || ""}`.trim()
      : property.currentValue
        ? "Manual value basis"
        : "Purchase price basis";
    return {
      value: estimatedValue,
      detail: annualAppreciationPct ? `${supportLabel} rolled forward` : supportLabel,
    };
  }, [dashboardAsOfDate, planningAssumptions?.annualValueGrowthPct, selected?.property, todayIso]);

  const selectedUnitsMissingOccupancy = selected?.units.filter((unit) => {
    const periods = getUnitOccupancyPeriods?.(selected.property.id, unit.name) || [];
    const hasCurrentPeriod = periods.some((period) => period.startDate <= dashboardAsOfDate && (!period.endDate || period.endDate >= dashboardAsOfDate));
    const hasActiveLease = leases.some((lease) => lease.propertyId === selected.property.id && lease.unit === unit.name && leaseIsActiveByDate(lease, dashboardAsOfDate));
    return !hasCurrentPeriod && !hasActiveLease;
  }) || [];
  const selectedRentalUnitsMissingLease = selected?.units.filter((unit) =>
    getUnitStatusForDate(unit, dashboardAsOfDate) === "Rental" &&
    !leases.some((lease) => lease.propertyId === selected.property.id && lease.unit === unit.name && leaseIsActiveByDate(lease, dashboardAsOfDate))
  ) || [];
  const selectedPropertyDocuments = selected ? documents.filter((document) =>
    document.propertyId === selected.property.id &&
    !document.transactionId &&
    !document.leaseId &&
    !document.workOrderId &&
    (!Array.isArray(document.relatedTransactionIds) || document.relatedTransactionIds.length === 0)
  ) : [];
  const renewalTrackedDocuments = selectedPropertyDocuments.filter((document) => document.expiresOn);
  const renewalIssues = renewalTrackedDocuments.filter((document) => documentRenewalStatus(document.expiresOn, dashboardAsOfDate).actionable);
  const readinessItems = selected ? [
    {
      key: "valuation",
      label: "Valuation support",
      ready: Boolean(selected.property.currentValue || selected.property.propertyValuations?.length),
      detail: "Add a manual value basis or supported valuation.",
      section: "valuation",
    },
    {
      key: "documents",
      label: "Property documents",
      ready: selected.propertyDocumentCount > 0,
      detail: "Attach at least one property-level document.",
      section: "documents",
    },
    {
      key: "occupancy",
      label: "Occupancy coverage",
      ready: selected.units.length > 0 && selectedUnitsMissingOccupancy.length === 0,
      detail: selected.units.length === 0 ? "Add the first unit." : `${selectedUnitsMissingOccupancy.length} unit${selectedUnitsMissingOccupancy.length === 1 ? "" : "s"} missing current occupancy coverage.`,
      section: "occupancy",
    },
    {
      key: "leases",
      label: "Rental lease coverage",
      ready: selectedRentalUnitsMissingLease.length === 0,
      detail: `${selectedRentalUnitsMissingLease.length} rental unit${selectedRentalUnitsMissingLease.length === 1 ? "" : "s"} missing an active lease.`,
      section: "occupancy",
    },
    ...(renewalTrackedDocuments.length ? [{
      key: "document-renewals",
      label: "Document renewals",
      ready: renewalIssues.length === 0,
      detail: renewalIssues.length
        ? `${renewalIssues.length} document${renewalIssues.length === 1 ? "" : "s"} expired or renewing within 60 days.`
        : "Tracked document renewals are current.",
      section: "documents",
    }] : []),
  ] : [];
  const readinessOpenItems = readinessItems.filter((item) => !item.ready);
  const editingUnit = selected?.units.find((unit) => unit.id === unitDraft.id);
  const unitLinkSummary = editingUnit ? actions.getUnitLinkSummary?.(editingUnit.propertyId, editingUnit.name) : { counts: {}, total: 0 };
  const normalizedUnitName = unitDraft.name.trim().toLocaleLowerCase();
  const duplicateUnitName = Boolean(normalizedUnitName && selected?.units.some((unit) => (
    unit.id !== unitDraft.id && unit.name.trim().toLocaleLowerCase() === normalizedUnitName
  )));

  const openRecordSection = (section) => {
    setTab("records");
    setRecordSection(readinessRecordSection(section));
  };

  const openReadinessItem = (item) => {
    if (item.key === "occupancy" && selected?.units.length === 0) {
      openUnitEditor();
      return;
    }
    openRecordSection(item.section);
  };

  const openUnitEditor = (unit = null) => {
    setUnitDraft(unit ? { id: unit.id, name: unit.name, status: unit.status } : { id: "", name: "", status: "Vacant" });
    setUnitEditorOpen(true);
  };

  const saveUnit = () => {
    if (!selected || !unitDraft.name.trim() || duplicateUnitName) return;
    if (unitDraft.id) {
      const existing = selected.units.find((unit) => unit.id === unitDraft.id);
      if (!existing) return;
      if (existing.name !== unitDraft.name.trim()) actions.renameUnit?.(existing.id, unitDraft.name.trim());
      if (existing.status !== unitDraft.status) actions.updateUnitStatus?.(existing.id, unitDraft.status);
    } else {
      if (!actions.addUnit?.(selected.property.id, unitDraft.name.trim(), unitDraft.status)) return;
    }
    setUnitEditorOpen(false);
  };

  const deleteUnit = () => {
    if (!unitDraft.id || !actions.deleteUnit?.(unitDraft.id)) return;
    setUnitEditorOpen(false);
  };

  const startPropertyMaintenance = () => {
    if (!selected) return;
    setPropertyFilter?.(selected.property.id);
    setWorkOrderDraft?.((previous) => ({ ...previous, propertyId: selected.property.id, unit: "Shared" }));
    setView?.("maintenance");
  };

  const openUnitWorkspace = (view) => {
    if (!selected || !unitDetail) return;
    setPropertyFilter?.(selected.property.id);
    setUnitFilter?.(unitDetail.name);
    if (view === "maintenance") {
      setWorkOrderDraft?.((previous) => ({ ...previous, propertyId: selected.property.id, unit: unitDetail.name }));
    }
    setUnitDetailId("");
    setView?.(view);
  };

  const openEdit = () => {
    if (!selected) return;
    const property = selected.property;
    setEditDraft({
      name: property.name || "",
      address: property.address || "",
      type: property.type || "Single Family",
      purchasedOn: property.purchasedOn || "",
      purchasePrice: property.purchasePrice ?? "",
      landValue: property.landValue ?? "",
      currentValue: property.currentValue ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!selected || !editDraft?.name.trim() || !editDraft?.address.trim()) return;
    actions.updatePropertyDetails?.(selected.property.id, {
      ...editDraft,
      name: editDraft.name.trim(),
      address: editDraft.address.trim(),
      purchasePrice: editDraft.purchasePrice === "" ? undefined : Number(editDraft.purchasePrice),
      landValue: editDraft.landValue === "" ? undefined : Number(editDraft.landValue),
      currentValue: editDraft.currentValue === "" ? undefined : Number(editDraft.currentValue),
    });
    setEditOpen(false);
  };

  const onPhotoFiles = async (event) => {
    if (!selected) return;
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/")).slice(0, 8);
    event.target.value = "";
    if (!files.length) return;
    setImageBusy(true);
    try {
      const existing = selected.property.photos || [];
      const added = await Promise.all(files.map(async (file, index) => ({
        id: `property-photo-${Date.now()}-${index}`,
        name: file.name,
        dataUrl: await resizePropertyImage(file),
        uploadedAt: new Date().toISOString(),
        isCover: existing.length === 0 && index === 0,
        caption: "",
        category: "Other",
        capturedOn: file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : "",
        unit: "Shared",
      })));
      actions.updatePropertyPhotos?.(selected.property.id, [...existing, ...added]);
    } finally {
      setImageBusy(false);
    }
  };

  const setCover = (photoId) => {
    actions.updatePropertyPhotos?.(selected.property.id, (selected.property.photos || []).map((photo) => ({ ...photo, isCover: photo.id === photoId })));
  };

  const removePhoto = (photoId) => {
    const remaining = (selected.property.photos || []).filter((photo) => photo.id !== photoId);
    if (remaining.length && !remaining.some((photo) => photo.isCover)) remaining[0] = { ...remaining[0], isCover: true };
    actions.updatePropertyPhotos?.(selected.property.id, remaining);
    setPhotoToRemove(null);
  };

  const editPhoto = (photo) => {
    setPhotoDraft({
      id: photo.id,
      caption: photo.caption || "",
      category: photo.category || "Other",
      capturedOn: photo.capturedOn || "",
      unit: photo.unit || "Shared",
    });
    setPhotoEditorOpen(true);
  };

  const savePhotoDetails = () => {
    if (!selected || !photoDraft) return;
    actions.updatePropertyPhotos?.(selected.property.id, (selected.property.photos || []).map((photo) => (
      photo.id === photoDraft.id ? { ...photo, ...photoDraft } : photo
    )));
    setPhotoEditorOpen(false);
  };

  const archiveSelectedProperty = () => {
    if (!selected || !actions.archiveProperty?.(selected.property.id)) return;
    if (propertyFilter === selected.property.id) {
      setPropertyFilter?.("all");
      setUnitFilter?.("all");
    }
    setShowArchived(true);
    setArchiveConfirmOpen(false);
  };

  const restoreSelectedProperty = () => {
    if (!selected) return;
    actions.restoreProperty?.(selected.property.id);
  };

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden shadow-none">
        <CardContent className="space-y-2 !p-3">
          {archivedPropertyCount ? (
            <div className="flex justify-end rounded-lg border border-slate-200 bg-white px-3 py-2">
              <Button size="sm" variant="secondary" onClick={() => setShowArchived((value) => !value)}>
                {showArchived ? "Hide archived" : `Show archived (${archivedPropertyCount})`}
              </Button>
            </div>
          ) : null}
          {rows.length > 1 ? <div className="hidden grid-cols-[minmax(220px,1.5fr)_90px_120px_150px_150px_90px_32px] gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[11px] font-medium uppercase text-slate-500 lg:grid">
            <span>Property</span><span>Occupancy</span><span>YTD cash flow</span><span className="flex items-center gap-1" title={VISIBLE_RENT_SCHEDULE_HELP}>Recorded / visible schedule <Info className="h-3 w-3" aria-hidden="true" /><span className="sr-only">{VISIBLE_RENT_SCHEDULE_HELP}</span></span><span>Next lease expiration</span><span>Open items</span><span />
          </div> : null}
          {rows.length === 0 ? <div className="p-6 text-sm text-slate-500">No properties match the current filter.</div> : rows.map((row) => {
            const active = row.property.id === selected?.property.id;
            return (
              <button key={row.property.id} type="button" onClick={() => { setSelectedPropertyId(row.property.id); setTab("overview"); setRecordSection("valuation"); }} className={`grid w-full grid-cols-2 items-center gap-x-4 gap-y-3 rounded-lg border border-slate-200 px-4 text-left ${rows.length === 1 ? "py-3 lg:grid-cols-[minmax(220px,1.5fr)_90px_120px_150px_150px_90px]" : "py-3 lg:grid-cols-[minmax(220px,1.5fr)_90px_120px_150px_150px_90px_32px]"} ${active ? "bg-teal-50/70" : "bg-white hover:bg-slate-50"}`}>
                <span className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1"><PropertyThumb property={row.property} className={rows.length === 1 ? "h-10 w-14" : "h-12 w-16"} /><span className="min-w-0"><span className="flex items-center gap-2"><span className="block truncate text-sm font-semibold text-slate-950">{row.property.name}</span>{row.property.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}</span><span className="block truncate text-xs text-slate-500">{row.property.address}</span><span className="mt-0.5 block text-[11px] text-slate-400">{row.units.length} unit{row.units.length === 1 ? "" : "s"}</span></span></span>
                <span className="text-sm font-medium text-slate-800"><span className={`mb-0.5 block text-[10px] uppercase text-slate-400 ${rows.length === 1 ? "" : "lg:hidden"}`}>Occupancy</span>{row.occupancy == null ? "Owner" : `${Math.round(row.occupancy * 100)}%`}</span>
                <span className={`text-sm font-semibold ${row.cashflow >= 0 ? "text-emerald-700" : "text-rose-700"}`}><span className={`mb-0.5 block text-[10px] font-medium uppercase text-slate-400 ${rows.length === 1 ? "" : "lg:hidden"}`}>YTD cash flow</span>{currency(row.cashflow)}</span>
                <span className="text-sm text-slate-800" title={VISIBLE_RENT_SCHEDULE_HELP}><span className={`mb-0.5 block text-[10px] uppercase text-slate-400 ${rows.length === 1 ? "" : "lg:hidden"}`}>Rent recorded / visible schedule</span>{currency(row.rentRecorded)} <span className="text-slate-400">/ {currency(row.scheduledRent)}</span></span>
                <span className="text-sm text-slate-700"><span className={`mb-0.5 block text-[10px] uppercase text-slate-400 ${rows.length === 1 ? "" : "lg:hidden"}`}>Next lease expiration</span>{row.nextLease ? `${row.nextLease.unit} | ${row.nextLease.actualEndDate || row.nextLease.endDate}` : "None upcoming"}</span>
                <span><span className={`mb-0.5 block text-[10px] uppercase text-slate-400 ${rows.length === 1 ? "" : "lg:hidden"}`}>Open items</span>{row.openItems ? <Badge className="!bg-amber-50 !text-amber-800">{row.openItems}</Badge> : <span className="text-xs text-slate-400">None</span>}</span>
                {rows.length > 1 ? <MoreHorizontal className="h-4 w-4 text-slate-400" /> : null}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selected ? (
        <Card className="overflow-hidden shadow-none">
          <div className="relative min-h-36 border-b border-slate-200 bg-slate-100">
            {((selected.property.photos || []).find((photo) => photo.isCover) || selected.property.photos?.[0])?.dataUrl ? (
              <img src={((selected.property.photos || []).find((photo) => photo.isCover) || selected.property.photos[0]).dataUrl} alt={`${selected.property.name} cover`} className="absolute inset-0 h-full w-full object-cover" />
            ) : <div className="absolute inset-0 flex items-center justify-center text-slate-300"><Building2 className="h-12 w-12" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
            <div className="relative flex min-h-44 flex-col justify-end gap-3 p-4 text-white sm:min-h-36 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2"><div className="text-lg font-semibold">{selected.property.name}</div>{selected.property.archivedAt ? <Badge className="!bg-white !text-slate-800">Archived</Badge> : null}</div><div className="text-sm text-slate-100">{selected.property.address} | {selected.property.type}</div></div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
                <Button size="sm" variant="secondary" className="min-w-0" onClick={() => photoInputRef.current?.click()} disabled={!canCreateEditRecords || imageBusy || Boolean(selected.property.archivedAt)}><Camera className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{imageBusy ? "Adding..." : "Add photos"}</span></Button>
                {selected.property.archivedAt ? <Button size="sm" variant="secondary" className="min-w-0" onClick={restoreSelectedProperty} disabled={!canCreateEditRecords}><RotateCcw className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Restore</span></Button> : <Button size="sm" variant="secondary" className="min-w-0" onClick={openEdit} disabled={!canCreateEditRecords}><Pencil className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Edit property</span></Button>}
              </div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onPhotoFiles} />
          </div>
          <CardContent className="!p-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="photos">Photos ({selected.property.photos?.length || 0})</TabsTrigger>
                <TabsTrigger value="records">Manage records</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="YTD cash flow" value={currency(selected.cashflow)} detail={`${currency(selected.income)} income | ${currency(selected.expenses)} expenses`} tone={selected.cashflow >= 0 ? "text-emerald-700" : "text-rose-700"} />
                  <Stat label="Occupancy" value={selected.occupancy == null ? "Owner occupied" : `${Math.round(selected.occupancy * 100)}%`} detail={`${selected.occupiedUnits.length} of ${selected.rentableUnits.length} rentable units`} />
                  <Stat label="Rent recorded" value={currency(selected.rentRecorded)} detail={`${currency(selected.scheduledRent)} visible schedule through ${dashboardAsOfDate}`} />
                  <Stat label="Current estimate" value={selectedValueSummary.value ? currency(selectedValueSummary.value) : "Not set"} detail={selectedValueSummary.detail} />
                  <Stat label="Open items" value={String(selected.openItems)} detail={`${selected.openReviewItems} review | ${selected.openMaintenance} maintenance`} tone={selected.openItems ? "text-amber-700" : "text-emerald-700"} />
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2"><div><div className="text-sm font-semibold text-slate-900">Units & leases</div><span className="text-xs text-slate-500">Select a unit for its full record summary.</span></div><Button size="sm" variant="secondary" onClick={() => openUnitEditor()} disabled={!canCreateEditRecords || Boolean(selected.property.archivedAt)}><Plus className="mr-1.5 h-4 w-4" />Add unit</Button></div>
                    {selected.units.length ? selected.units.map((unit) => {
                      const status = getUnitStatusForDate(unit, dashboardAsOfDate);
                      const lease = leases.find((item) => item.propertyId === selected.property.id && item.unit === unit.name && leaseIsActiveByDate(item, dashboardAsOfDate));
                      return (
                        <div key={unit.id} className="grid items-center gap-2 border-b border-slate-200 px-3 py-2.5 last:border-b-0 sm:grid-cols-[1fr_130px_150px_auto]">
                          <button type="button" onClick={() => setUnitDetailId(unit.id)} className="min-w-0 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"><div className="flex items-center gap-1 text-sm font-medium text-slate-900">{/^unit\b/i.test(String(unit.name || "")) ? unit.name : `Unit ${unit.name}`}<ChevronRight className="h-3.5 w-3.5 text-slate-400" /></div><div className="truncate text-xs text-slate-500">{lease ? lease.tenantName : status === "Owner-Occupied" ? "Owner occupied" : "No active lease"}</div></button>
                          <Badge variant="secondary" className="w-fit">{unitStatusLabel[status] || status}</Badge>
                          <div className="text-xs text-slate-600">{lease ? <><span className="block font-medium text-slate-800">{currency(lease.monthlyRent)} / mo</span><span>Ends {lease.actualEndDate || lease.endDate}</span></> : "No rent scheduled"}</div>
                          <div className="flex justify-end gap-1.5"><Button size="sm" variant="secondary" onClick={() => lease ? openLease(lease) : openLeaseForUnit(selected.property.id, unit.name)} disabled={Boolean(selected.property.archivedAt) && !lease}>{lease ? "Lease" : "Occupancy"}</Button><Button size="sm" variant="secondary" className="h-9 w-9 p-0" title={`Manage ${unit.name}`} onClick={() => openUnitEditor(unit)} disabled={Boolean(selected.property.archivedAt)}><Pencil className="h-4 w-4" /></Button></div>
                        </div>
                      );
                    }) : <div className="p-4 text-sm text-slate-500">No units are attached to this property.</div>}
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3"><div><div className="text-sm font-semibold text-slate-900">Property readiness</div><div className="text-[11px] text-slate-500">Select an item to open the matching records.</div></div><Badge className={readinessOpenItems.length ? "!bg-amber-50 !text-amber-800" : "!bg-emerald-50 !text-emerald-700"}>{readinessItems.length - readinessOpenItems.length}/{readinessItems.length} ready</Badge></div>
                      <div className="mt-2 space-y-1">
                        {readinessOpenItems.length ? readinessOpenItems.map((item) => (
                          <button key={item.key} type="button" onClick={() => openReadinessItem(item)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-amber-50">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-slate-800">{item.label}</span><span className="block text-[11px] text-slate-500">{item.detail}</span></span><ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          </button>
                        )) : <div className="flex items-center gap-2 px-2 py-2 text-xs text-emerald-700"><ShieldCheck className="h-4 w-4" />Core property records are ready.</div>}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-900">Quick actions</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <Button size="sm" variant="secondary" className="justify-start" onClick={() => openDashboardQuickAddForScope?.(selected.property.id, "Shared")} disabled={Boolean(selected.property.archivedAt)}><ReceiptText className="mr-2 h-4 w-4" />Transaction</Button>
                        <Button size="sm" variant="secondary" className="justify-start" onClick={() => { setLeaseUnit(selected.units[0]?.name || ""); setLeasePickerOpen(true); }} disabled={!selected.units.length || Boolean(selected.property.archivedAt)}><CalendarClock className="mr-2 h-4 w-4" />Lease</Button>
                        <Button size="sm" variant="secondary" className="justify-start" onClick={startPropertyMaintenance} disabled={Boolean(selected.property.archivedAt)}><Wrench className="mr-2 h-4 w-4" />Maintenance</Button>
                        <Button size="sm" variant="secondary" className="justify-start" onClick={() => openDocumentImportPicker?.({ propertyId: selected.property.id, unit: "Shared", tags: "property" })} disabled={Boolean(selected.property.archivedAt)}><FileText className="mr-2 h-4 w-4" />Document</Button>
                        <Button size="sm" variant="secondary" className="col-span-2 justify-start" onClick={() => openUnitEditor()} disabled={!canCreateEditRecords || Boolean(selected.property.archivedAt)}><Plus className="mr-2 h-4 w-4" />Add unit</Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
                    <div><div className="text-sm font-semibold text-slate-900">Recent property activity</div><div className="text-xs text-slate-500">Changes to records, documents, units, and property settings.</div></div>
                    <Button size="sm" variant="secondary" onClick={() => { setPropertyFilter?.(selected.property.id); setView?.("activity"); }}>View all activity</Button>
                  </div>
                  {selectedActivities.length ? <div className="divide-y divide-slate-200">{selectedActivities.map((entry) => (
                    <div key={entry.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500"><PropertyActivityIcon entry={entry} /></span>
                      <div className="min-w-0"><div className="text-sm font-medium text-slate-800">{entry.summary}</div>{entry.details ? <div className="truncate text-xs text-slate-500" title={entry.details}>{entry.details}</div> : null}</div>
                      <div className="text-xs text-slate-400 sm:text-right">{String(entry.at || "").slice(0, 10)}{entry.unit && entry.unit !== "Shared" ? <span className="block">{entry.unit}</span> : null}</div>
                    </div>
                  ))}</div> : <div className="px-3 py-4 text-sm text-slate-500">Property changes will appear here as records are updated.</div>}
                </div>
              </TabsContent>

              <TabsContent value="photos">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3"><div><div className="text-sm font-semibold text-slate-900">Property photos</div><div className="text-xs text-slate-500">Use a cover image in the portfolio and keep up to date condition references.</div></div><Button size="sm" onClick={() => photoInputRef.current?.click()} disabled={!canCreateEditRecords || imageBusy || Boolean(selected.property.archivedAt)}><ImagePlus className="mr-2 h-4 w-4" />Add photos</Button></div>
                {selected.property.photos?.length ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {selected.property.photos.map((photo) => <div key={photo.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white"><div className="relative aspect-[4/3]"><img src={photo.dataUrl} alt={photo.caption || photo.name} className="h-full w-full object-cover" />{photo.isCover ? <Badge className="absolute left-2 top-2 !bg-teal-700 !text-white"><Check className="mr-1 h-3 w-3" />Cover</Badge> : null}</div><div className="p-2"><div className="truncate text-sm font-medium text-slate-800" title={photo.caption || photo.name}>{photo.caption || photo.name}</div><div className="mt-1 flex flex-wrap gap-1"><Badge variant="secondary">{photo.category || "Other"}</Badge><Badge variant="secondary">{photo.unit || "Shared"}</Badge>{photo.capturedOn ? <Badge variant="secondary">{photo.capturedOn}</Badge> : null}</div><div className="mt-2 flex flex-wrap justify-between gap-1"><Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => editPhoto(photo)} disabled={Boolean(selected.property.archivedAt)}><Pencil className="mr-1 h-3.5 w-3.5" />Details</Button><div className="flex gap-1">{!photo.isCover ? <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setCover(photo.id)} disabled={Boolean(selected.property.archivedAt)}>Set cover</Button> : null}<Button size="sm" variant="secondary" className="h-7 w-7 p-0 text-rose-700" title="Remove photo" onClick={() => setPhotoToRemove(photo)} disabled={Boolean(selected.property.archivedAt)}><Trash2 className="h-3.5 w-3.5" /></Button></div></div></div></div>)}
                  </div>
                ) : <button type="button" onClick={() => photoInputRef.current?.click()} disabled={Boolean(selected.property.archivedAt)} className="mt-3 flex min-h-36 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-teal-400 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60"><Camera className="mb-2 h-6 w-6" /><span className="text-sm font-medium">Add the first property photo</span><span className="text-xs">Exterior, units, systems, or condition references</span></button>}
              </TabsContent>

              <TabsContent value="records" className="pt-1">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Manage records</div>
                    <div className="text-xs text-slate-500">Choose one record area to review or update.</div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{selected.property.propertyValuations?.length || 0} valuations</span>
                    <span>|</span>
                    <span>{selected.propertyDocumentCount} property documents</span>
                    <span>|</span>
                    <span>{selected.property.operationNotes?.length || 0} notes</span>
                  </div>
                </div>
                <Tabs value={recordSection} onValueChange={setRecordSection} className="space-y-3">
                  <TabsList className="h-auto w-full justify-start gap-0.5 overflow-x-auto p-1">
                    <TabsTrigger value="valuation" className="gap-2"><TrendingUp className="h-4 w-4" />Valuation</TabsTrigger>
                    <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documents <span className="text-xs text-slate-400">{selected.propertyDocumentCount}</span></TabsTrigger>
                    <TabsTrigger value="notes" className="gap-2"><KeyRound className="h-4 w-4" />Operations <span className="text-xs text-slate-400">{selected.property.operationNotes?.length || 0}</span></TabsTrigger>
                    <TabsTrigger value="occupancy" className="gap-2"><Building2 className="h-4 w-4" />Occupancy <span className="text-xs text-slate-400">{selected.units.length}</span></TabsTrigger>
                  </TabsList>
                  <PropertyRecordEditor {...props} propertyFilter={selected.property.id} recordSection={recordSection} />
                </Tabs>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(unitDetail)} onOpenChange={(open) => { if (!open) setUnitDetailId(""); }}>
        <div className="ml-auto flex h-[calc(100vh-2rem)] w-[min(96vw,620px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-slate-950">{unitDetail && (/^unit\b/i.test(unitDetail.name) ? unitDetail.name : `Unit ${unitDetail.name}`)}</h2>{unitDetail ? <Badge variant="secondary">{unitStatusLabel[unitDetailStatus] || unitDetailStatus}</Badge> : null}</div>
              <div className="truncate text-sm text-slate-500">{selected?.property.name} | Unit record</div>
            </div>
            <Button size="sm" variant="secondary" className="h-9 w-9 shrink-0 p-0" title="Close unit details" onClick={() => setUnitDetailId("")}><X className="h-4 w-4" /></Button>
          </div>

          {unitDetail ? <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Occupancy</div><div className="mt-1 text-sm font-semibold text-slate-900">{unitDetailLease?.tenantName || (unitDetailStatus === "Owner-Occupied" ? "Owner occupied" : unitStatusLabel[unitDetailStatus] || unitDetailStatus)}</div></div>
              <div className="rounded-lg border border-slate-200 p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Rent recorded YTD</div><div className="mt-1 text-sm font-semibold text-emerald-700">{currency(unitDetailRent)}</div></div>
              <div className="rounded-lg border border-slate-200 p-3"><div className="text-[11px] font-medium uppercase text-slate-500">Monthly rent</div><div className="mt-1 text-sm font-semibold text-slate-900">{unitDetailLease ? currency(unitDetailLease.monthlyRent) : "No rent scheduled"}</div></div>
            </div>

            <section className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2"><div><div className="text-sm font-semibold text-slate-900">Lease & occupancy</div><div className="text-xs text-slate-500">Current agreement and recent status history.</div></div>{unitDetailLease ? <Button size="sm" variant="secondary" onClick={() => openLease(unitDetailLease)}>View lease</Button> : <Button size="sm" variant="secondary" onClick={() => { setUnitDetailId(""); openLeaseForUnit(selected.property.id, unitDetail.name); }} disabled={Boolean(selected?.property.archivedAt)}>Manage occupancy</Button>}</div>
              <div className="divide-y divide-slate-200">
                {unitDetailTimeline.slice(0, 4).map((item) => <div key={item.id} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[1fr_auto]"><div><div className="text-sm font-medium text-slate-800">{item.label}</div><div className="text-xs text-slate-500">{item.detail}</div></div><div className="text-xs text-slate-500 sm:text-right">{item.startDate || "Date not set"}<span className="block">{item.endDate ? `to ${item.endDate}` : "Current"}</span></div></div>)}
                {!unitDetailTimeline.length ? <div className="px-3 py-3 text-sm text-slate-500">No occupancy history recorded yet.</div> : null}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Wrench className="h-4 w-4 text-slate-500" />Open maintenance</div><Badge variant="secondary">{unitDetailMaintenance.length}</Badge></div>
                <div className="divide-y divide-slate-200">{unitDetailMaintenance.slice(0, 3).map((order) => <div key={order.id} className="px-3 py-2.5"><div className="truncate text-sm font-medium text-slate-800">{order.title}</div><div className="text-xs text-slate-500">{order.status} | {order.priority || "Normal"}</div></div>)}{!unitDetailMaintenance.length ? <div className="px-3 py-3 text-sm text-slate-500">No open work orders.</div> : null}</div>
                <div className="border-t border-slate-200 p-2"><Button size="sm" variant="secondary" className="w-full" onClick={() => openUnitWorkspace("maintenance")}>Open maintenance</Button></div>
              </section>

              <section className="rounded-lg border border-slate-200">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-slate-500" />Documents</div><Badge variant="secondary">{unitDetailDocuments.length}</Badge></div>
                <div className="divide-y divide-slate-200">{unitDetailDocuments.slice(0, 3).map((document) => <div key={document.id} className="px-3 py-2.5"><div className="truncate text-sm font-medium text-slate-800">{document.name || document.type || "Document"}</div><div className="text-xs text-slate-500">{document.type || "File"} | {document.uploadedAt ? String(document.uploadedAt).slice(0, 10) : "Date not recorded"}</div></div>)}{!unitDetailDocuments.length ? <div className="px-3 py-3 text-sm text-slate-500">No unit documents linked.</div> : null}</div>
                <div className="border-t border-slate-200 p-2"><Button size="sm" variant="secondary" className="w-full" onClick={() => openUnitWorkspace("documents")}>Open documents</Button></div>
              </section>
            </div>

            <section className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2"><div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Camera className="h-4 w-4 text-slate-500" />Unit photos</div><Button size="sm" variant="secondary" onClick={() => { setUnitDetailId(""); setTab("photos"); }}>Manage photos</Button></div>
              {unitDetailPhotos.length ? <div className="grid grid-cols-3 gap-2 p-3">{unitDetailPhotos.slice(0, 6).map((photo) => <img key={photo.id} src={photo.dataUrl} alt={photo.caption || photo.name} className="aspect-[4/3] w-full rounded-md object-cover" />)}</div> : <div className="px-3 py-3 text-sm text-slate-500">No photos are scoped to this unit.</div>}
            </section>
          </div> : null}

          {unitDetail ? <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-3 sm:grid-cols-4"><Button size="sm" variant="secondary" onClick={() => { const unit = unitDetail; setUnitDetailId(""); openUnitEditor(unit); }} disabled={Boolean(selected?.property.archivedAt)}><Pencil className="mr-1.5 h-4 w-4" />Edit unit</Button><Button size="sm" variant="secondary" onClick={() => openDashboardQuickAddForScope?.(selected.property.id, unitDetail.name)} disabled={Boolean(selected?.property.archivedAt)}><ReceiptText className="mr-1.5 h-4 w-4" />Transaction</Button><Button size="sm" variant="secondary" onClick={() => openUnitWorkspace("maintenance")} disabled={Boolean(selected?.property.archivedAt)}><Wrench className="mr-1.5 h-4 w-4" />Maintenance</Button><Button size="sm" variant="secondary" onClick={() => openDocumentImportPicker?.({ propertyId: selected.property.id, unit: unitDetail.name, tags: "unit" })} disabled={Boolean(selected?.property.archivedAt)}><FileText className="mr-1.5 h-4 w-4" />Document</Button></div> : null}
        </div>
      </Dialog>

      <Dialog open={unitEditorOpen} onOpenChange={setUnitEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{unitDraft.id ? "Manage unit" : "Add unit"}</DialogTitle><div className="text-sm text-slate-500">{unitDraft.id ? "Update occupancy status or remove an unused unit." : `Add a unit to ${selected?.property.name || "this property"}.`}</div></DialogHeader>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">Unit name<Input className="mt-1" value={unitDraft.name} disabled={Boolean(unitDraft.id && unitLinkSummary.total > 0)} onChange={(event) => setUnitDraft({ ...unitDraft, name: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Current status<Select value={unitDraft.status} onValueChange={(value) => setUnitDraft({ ...unitDraft, status: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Vacant">Vacant</SelectItem><SelectItem value="Rental">Rental</SelectItem><SelectItem value="Owner-Occupied">Owner occupied</SelectItem></SelectContent></Select></label>
          </div>
          {duplicateUnitName ? <div className="mt-2 text-xs font-medium text-rose-700">A unit with this name already exists at this property.</div> : null}
          {unitDraft.id && unitLinkSummary.total > 0 ? <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">The unit name and delete action are locked because {unitLinkSummary.total} linked record{unitLinkSummary.total === 1 ? " exists" : "s exist"}. Lease, transaction, document, maintenance, asset, occupancy, and recurring history stay attached to the original unit name.</div> : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
            <div>{unitDraft.id ? <Button variant="secondary" className="text-rose-700" onClick={deleteUnit} disabled={!canDeleteRecords || unitLinkSummary.total > 0}><Trash2 className="mr-2 h-4 w-4" />Delete unit</Button> : null}</div>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => setUnitEditorOpen(false)}>Cancel</Button><Button onClick={saveUnit} disabled={!canCreateEditRecords || !unitDraft.name.trim() || duplicateUnitName}>{unitDraft.id ? "Save unit" : "Add unit"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={leasePickerOpen} onOpenChange={setLeasePickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add lease</DialogTitle><div className="text-sm text-slate-500">Choose the unit for the new lease.</div></DialogHeader>
          <label className="mt-4 block text-xs font-medium text-slate-600">Unit<Select value={leaseUnit} onValueChange={setLeaseUnit}><SelectTrigger className="mt-1"><SelectValue placeholder="Choose unit" /></SelectTrigger><SelectContent>{selected?.units.map((unit) => <SelectItem key={unit.id} value={unit.name}>{/^unit\b/i.test(unit.name) ? unit.name : `Unit ${unit.name}`}</SelectItem>)}</SelectContent></Select></label>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setLeasePickerOpen(false)}>Cancel</Button><Button onClick={() => { if (!selected || !leaseUnit) return; setLeasePickerOpen(false); openNewLeaseForUnit?.(selected.property.id, leaseUnit); }} disabled={!leaseUnit}><ClipboardPlus className="mr-2 h-4 w-4" />Continue</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Edit property</DialogTitle><div className="text-sm text-slate-500">Update the core record. Valuation history and supporting documents remain under Manage records.</div></DialogHeader>
          {editDraft ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">Name<Input className="mt-1" value={editDraft.name} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Property type<Select value={editDraft.type} onValueChange={(value) => setEditDraft({ ...editDraft, type: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{["Single Family", "Duplex", "Triplex", "Fourplex", "Condo", "Townhome", "Other"].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">Address<Input className="mt-1" value={editDraft.address} onChange={(event) => setEditDraft({ ...editDraft, address: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Purchased on<Input className="mt-1" type="date" value={editDraft.purchasedOn} onChange={(event) => setEditDraft({ ...editDraft, purchasedOn: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Purchase price<Input className="mt-1" type="number" value={editDraft.purchasePrice} onChange={(event) => setEditDraft({ ...editDraft, purchasePrice: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Land value<Input className="mt-1" type="number" value={editDraft.landValue} onChange={(event) => setEditDraft({ ...editDraft, landValue: event.target.value })} /></label>
            <label className="text-xs font-medium text-slate-600">Manual value basis<Input className="mt-1" type="number" value={editDraft.currentValue} onChange={(event) => setEditDraft({ ...editDraft, currentValue: event.target.value })} /><span className="mt-1 block text-[11px] font-normal text-slate-500">Fallback support used when no valuation history exists.</span></label>
          </div> : null}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><Button variant="secondary" className="text-amber-800" onClick={() => { setEditOpen(false); setArchiveConfirmOpen(true); }} disabled={!canCreateEditRecords}><Archive className="mr-2 h-4 w-4" />Archive property</Button><div className="flex gap-2"><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={saveEdit} disabled={!editDraft?.name.trim() || !editDraft?.address.trim()}><CircleDollarSign className="mr-2 h-4 w-4" />Save property</Button></div></div>
        </DialogContent>
      </Dialog>

      <Dialog open={photoEditorOpen} onOpenChange={setPhotoEditorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Photo details</DialogTitle><div className="text-sm text-slate-500">Add context so condition and system photos are useful later.</div></DialogHeader>
          {photoDraft ? <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-600">Caption<Input className="mt-1" value={photoDraft.caption} placeholder="Front exterior, Unit A kitchen..." onChange={(event) => setPhotoDraft({ ...photoDraft, caption: event.target.value })} /></label>
            <label className="block text-xs font-medium text-slate-600">Category<Select value={photoDraft.category} onValueChange={(value) => setPhotoDraft({ ...photoDraft, category: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{PROPERTY_PHOTO_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></label>
            <label className="block text-xs font-medium text-slate-600">Scope<Select value={photoDraft.unit} onValueChange={(value) => setPhotoDraft({ ...photoDraft, unit: value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Shared">Shared property</SelectItem>{selected?.units.map((unit) => <SelectItem key={unit.id} value={unit.name}>{/^unit\b/i.test(unit.name) ? unit.name : `Unit ${unit.name}`}</SelectItem>)}</SelectContent></Select></label>
            <label className="block text-xs font-medium text-slate-600">Captured on<Input className="mt-1" type="date" value={photoDraft.capturedOn} onChange={(event) => setPhotoDraft({ ...photoDraft, capturedOn: event.target.value })} /></label>
          </div> : null}
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setPhotoEditorOpen(false)}>Cancel</Button><Button onClick={savePhotoDetails} disabled={!photoDraft}>Save details</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(photoToRemove)} onOpenChange={(open) => { if (!open) setPhotoToRemove(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Remove photo?</DialogTitle><div className="text-sm text-slate-500">{photoToRemove?.caption || photoToRemove?.name || "This photo"} will be permanently removed from the property record. This cannot be undone.{photoToRemove?.isCover ? " The next available photo will become the cover image." : ""}</div></DialogHeader>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setPhotoToRemove(null)}>Cancel</Button><Button variant="destructive" onClick={() => photoToRemove && removePhoto(photoToRemove.id)}><Trash2 className="mr-2 h-4 w-4" />Remove photo</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Archive property?</DialogTitle><div className="text-sm text-slate-500">This hides {selected?.property.name || "the property"} from the active portfolio. Transactions, leases, documents, and history remain intact, and the property can be restored.</div></DialogHeader>
          <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setArchiveConfirmOpen(false)}>Cancel</Button><Button onClick={archiveSelectedProperty}><Archive className="mr-2 h-4 w-4" />Archive property</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
