"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { MobileMileageEntry } from "@/lib/mileage";
import { buildJpegPagesPdf, type PreparedPdfPage } from "@/lib/photo-pdf";
import type { PropertyCatalogItem } from "@/lib/property-catalog";
import type { MobileSubmission } from "@/lib/submissions";
import type { RetentionOverview } from "@/lib/retention";
import { emptyMemory, hasDraftContent, parseCaptureMemory, rememberPurpose, type CaptureDraft, type CaptureMemory } from "@/lib/capture-drafts";

import { formatMaintenanceReport, parseMaintenanceReport, type MaintenanceReport } from "@/lib/maintenance-report";

type PendingEdit = { id: string; type: "capture" | "mileage"; kind: CaptureKind; expectedUpdatedAt: string; propertyLabel: string; unitLabel: string; note: string; tripDate: string; businessMiles: string; purpose: string; startLocation: string; endLocation: string; maintenanceTitle: string; maintenanceLocation: string; maintenanceUrgency: MaintenanceReport["urgency"] };

type Props = {
  displayName: string;
  signOutPath: string | null;
  draftOwner: string;
  companionVersion: string;
};

type ApiError = { error?: string };
type CaptureKind = "receipt" | "maintenance" | "mileage";

const MAX_SELECTED_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 700 * 1024;
const PDF_CHUNK_BYTES = 512 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const MAX_CAPTURE_PAGES = 8;
const MAX_MULTI_PHOTO_SOURCE_BYTES = 60 * 1024 * 1024;
const MANUAL_CHOICE = "__manual__";

export function MobileCaptureApp({ displayName, signOutPath, draftOwner, companionVersion }: Props) {
  const [editing, setEditing] = useState<PendingEdit | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editSavingRef = useRef(false);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [maintenanceTitle, setMaintenanceTitle] = useState("");
  const [maintenanceLocation, setMaintenanceLocation] = useState("");
  const [maintenanceUrgency, setMaintenanceUrgency] = useState<MaintenanceReport["urgency"]>("Routine");
  const [reviewing, setReviewing] = useState(false);
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const reviewDialogRef = useRef<HTMLDialogElement>(null);
  const [screen, setScreen] = useState<"capture" | "inbox" | "settings">("capture");
  const [memoryReady, setMemoryReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [importedReceipts, setImportedReceipts] = useState<{ id: string; kind: string; importedAt: string; capturedAt?: string }[]>([]);
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<CaptureMemory["drafts"]>({});
  const [recentPurposes, setRecentPurposes] = useState<string[]>([]);
  const memoryRef = useRef<CaptureMemory>(emptyMemory());
  const syncInFlight = useRef(false);
  const savingLock = useRef(false);
  const retentionEditing = useRef(false);
  const memoryKey = `rental-companion:captures:v1:${draftOwner}`;
  const [submissions, setSubmissions] = useState<MobileSubmission[]>([]);
  const [mileageEntries, setMileageEntries] = useState<MobileMileageEntry[]>([]);
  const [propertyCatalog, setPropertyCatalog] = useState<PropertyCatalogItem[]>([]);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("receipt");
  const [files, setFiles] = useState<File[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [propertyLabel, setPropertyLabel] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [note, setNote] = useState("");
  const [tripDate, setTripDate] = useState(() => localIsoDate());
  const [businessMiles, setBusinessMiles] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startLocation, setStartLocation] = useState("");
  const [endLocation, setEndLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadNeedsAttention, setUploadNeedsAttention] = useState(false);
  const [retentionOverview, setRetentionOverview] = useState<RetentionOverview | null>(null);
  const [retentionChoice, setRetentionChoice] = useState<0 | 7 | 30>(0);
  const [retentionBusy, setRetentionBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const preparedBundleRef = useRef<{ signature: string; file: File } | null>(null);
  const uploadIdentityRef = useRef<{ hash: string; id: string } | null>(null);

  const currentDraft: CaptureDraft = { maintenanceTitle, maintenanceLocation, maintenanceUrgency, selectedPropertyId, selectedUnitId, propertyLabel, unitLabel, note, tripDate, businessMiles, purpose, startLocation, endLocation };
  const currentDraftRef = useRef(currentDraft);
  currentDraftRef.current = currentDraft;
  function restoreFields(draft: Partial<CaptureDraft>) {
    setSelectedPropertyId(draft.selectedPropertyId || ""); setSelectedUnitId(draft.selectedUnitId || "");
    setPropertyLabel(draft.propertyLabel || ""); setUnitLabel(draft.unitLabel || "");
    setMaintenanceTitle(draft.maintenanceTitle || ""); setMaintenanceLocation(draft.maintenanceLocation || ""); setMaintenanceUrgency(draft.maintenanceUrgency === "Urgent" || draft.maintenanceUrgency === "Soon" ? draft.maintenanceUrgency : "Routine");
    setNote(draft.note || ""); setTripDate(draft.tripDate || localIsoDate()); setBusinessMiles(draft.businessMiles || "");
    setPurpose(draft.purpose || ""); setStartLocation(draft.startLocation || ""); setEndLocation(draft.endLocation || "");
  }
  function persistMemory() {
    try { localStorage.setItem(memoryKey, JSON.stringify(memoryRef.current)); setDrafts({ ...memoryRef.current.drafts }); return true; }
    catch { setDraftMessage("Phone draft storage is unavailable. Keep this page open until you send your capture."); return false; }
  }
  useEffect(() => {
    try {
      memoryRef.current = parseCaptureMemory(localStorage.getItem(memoryKey));
      restoreFields(memoryRef.current.drafts.receipt || memoryRef.current.scope || {});
      setRecentPurposes(memoryRef.current.recentPurposes);
      setDrafts({ ...memoryRef.current.drafts });
      if (Object.keys(memoryRef.current.drafts).length) setDraftMessage("Saved text drafts are available in their capture type. Reselect any photos or PDF after reopening.");
    } catch { setDraftMessage("Phone draft storage is unavailable. Keep this page open until you send your capture."); }
    setMemoryReady(true);
  }, [memoryKey]);
  useEffect(() => {
    if (!memoryReady) return;
    if (hasDraftContent(currentDraft)) memoryRef.current.drafts[captureKind] = currentDraft;
    else delete memoryRef.current.drafts[captureKind];
    memoryRef.current.scope = { selectedPropertyId, selectedUnitId, propertyLabel, unitLabel };
    persistMemory();
  }, [memoryReady, memoryKey, captureKind, selectedPropertyId, selectedUnitId, propertyLabel, unitLabel, note, tripDate, businessMiles, purpose, startLocation, endLocation, maintenanceTitle, maintenanceLocation, maintenanceUrgency]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (editing || files.length || saving || hasDraftContent(currentDraftRef.current)) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [files.length, saving, editing]);
  function changeCaptureKind(kind: CaptureKind) {
    if (saving) return false;
    if (kind === captureKind) return true;
    if (files.length && !window.confirm("Switch capture type and remove the selected files? Text drafts stay saved; files must be selected again.")) return false;
    if (hasDraftContent(currentDraft)) memoryRef.current.drafts[captureKind] = currentDraft;
    else delete memoryRef.current.drafts[captureKind];
    if (!persistMemory()) return false;
    setFiles([]); preparedBundleRef.current = null; uploadIdentityRef.current = null; setUploadNeedsAttention(false); setUploadProgress(null);
    restoreFields(memoryRef.current.drafts[kind] || memoryRef.current.scope || {});
    setCaptureKind(kind); setError(null); setMessage(null); return true;
  }

  function resumeDraft(kind: CaptureKind) {
    if (changeCaptureKind(kind)) setScreen("capture");
  }
  function clearDraft(kind: CaptureKind) {
    if (saving || !window.confirm(`Clear the ${kind} draft on this device? Sent captures and desktop records remain saved.`)) return;
    const previous = memoryRef.current.drafts[kind]; delete memoryRef.current.drafts[kind];
    if (!persistMemory()) { if (previous) memoryRef.current.drafts[kind] = previous; return; }
    if (kind === captureKind) {
      restoreFields(memoryRef.current.scope || {}); setFiles([]); preparedBundleRef.current = null; uploadIdentityRef.current = null;
      setUploadNeedsAttention(false); setError(null); setMessage(null);
    }
    setDraftMessage("Draft cleared on this device.");
  }

  const loadData = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const [submissionsResponse, mileageResponse, catalogResponse] = await Promise.all([
        fetch("/api/submissions", { cache: "no-store" }),
        fetch("/api/mileage", { cache: "no-store" }),
        fetch("/api/property-catalog", { cache: "no-store" }),
      ]);
      const submissionsBody = (await submissionsResponse.json()) as { submissions?: MobileSubmission[] } & ApiError;
      if (!submissionsResponse.ok) throw new Error(submissionsBody.error || "Could not load your captures.");
      setSubmissions(submissionsBody.submissions ?? []);
      const mileageBody = (await mileageResponse.json()) as { mileageEntries?: MobileMileageEntry[] } & ApiError;
      if (!mileageResponse.ok) throw new Error(mileageBody.error || "Could not load your mileage entries.");
      setMileageEntries(mileageBody.mileageEntries ?? []);

      if (catalogResponse.ok) {
        const catalogBody = (await catalogResponse.json()) as { properties?: PropertyCatalogItem[]; updatedAt?: string | null };
        setPropertyCatalog(Array.isArray(catalogBody.properties) ? catalogBody.properties : []);
        setCatalogUpdatedAt(catalogBody.updatedAt || null); setCatalogError(null);
      } else {
        setCatalogError("Property choices could not refresh. Try again when connected.");
      }
      const retentionResponse = await fetch("/api/retention", { cache: "no-store" });
      const retentionBody = await readApiResponse<{ overview?: RetentionOverview } & ApiError>(retentionResponse);
      if (!retentionResponse.ok || !retentionBody.overview) {
        throw new Error(retentionBody.error || "Could not load cloud retention settings.");
      }
      setRetentionOverview(retentionBody.overview);
      if (!retentionEditing.current) setRetentionChoice(retentionBody.overview.retentionDays);
      const handoffResponse = await fetch("/api/handoff", { cache: "no-store" });
      const handoff = await readApiResponse<{ imported?: { id: string; kind: string; importedAt: string; capturedAt?: string }[] } & ApiError>(handoffResponse);
      if (!handoffResponse.ok) throw new Error(handoff.error || "Import confirmations could not refresh.");
      setImportedReceipts(handoff.imported || []);
      setLastSync(new Date().toISOString()); setSyncError(null);
    } catch (caught) {
      setSyncError(caught instanceof Error ? caught.message : "Could not load your captures.");
    } finally {
      syncInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    const refresh = () => { setOnline(navigator.onLine); if (document.visibilityState === "visible" && navigator.onLine) void loadData(); };
    setOnline(navigator.onLine);
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener("online", refresh); window.addEventListener("offline", refresh); window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearTimeout(timeoutId); window.clearInterval(interval); window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [loadData]);

  useEffect(() => { if (editing && !editDialogRef.current?.open) editDialogRef.current?.showModal(); }, [editing]);
  function beginEdit(item: MobileSubmission | MobileMileageEntry, type: "capture" | "mileage") {
    if (item.status !== "pending") return;
    const trip = type === "mileage" ? item as MobileMileageEntry : null;
    const capture = type === "capture" ? item as MobileSubmission : null;
    const report = capture?.kind === "maintenance" ? parseMaintenanceReport(capture.note) : null;
    setEditError(null);
    setEditing({ id: item.id, type, kind: trip ? "mileage" : capture!.kind, expectedUpdatedAt: item.updatedAt, propertyLabel: item.propertyLabel || "", unitLabel: item.unitLabel || "", note: report?.details || item.note || "", tripDate: trip?.tripDate || "", businessMiles: trip ? String(trip.businessMiles) : "", purpose: trip?.purpose || "", startLocation: trip?.startLocation || "", endLocation: trip?.endLocation || "", maintenanceTitle: report?.title || "", maintenanceLocation: report?.location || "", maintenanceUrgency: report?.urgency || "Routine" });
  }
  async function savePendingEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || editSavingRef.current) return;
    const draft = editing;
    if (draft.kind === "maintenance" && (!draft.maintenanceTitle.trim() || !draft.maintenanceLocation.trim() || !draft.note.trim())) { setEditError("Add the issue title, location, and details."); return; }
    if (draft.kind === "maintenance" && draft.note.length > 280) { setEditError("Shorten issue details to 280 characters before saving. Your existing text is still here."); return; }
    editSavingRef.current = true; setEditBusy(true); setEditError(null);
    try {
      const response = await fetch(`/api/${draft.type === "mileage" ? "mileage" : "submissions"}/${encodeURIComponent(draft.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, note: draft.kind === "maintenance" ? formatMaintenanceReport({ title: draft.maintenanceTitle, location: draft.maintenanceLocation, urgency: draft.maintenanceUrgency, details: draft.note }) : draft.note }) });
      const body = await readApiResponse<{ submission?: MobileSubmission; mileageEntry?: MobileMileageEntry } & ApiError>(response);
      if (!response.ok) { if (response.status === 409) void loadData(); throw new Error(body.error || "Edits could not be saved."); }
      if (draft.type === "mileage" && body.mileageEntry) setMileageEntries(current => current.map(item => item.id === draft.id ? body.mileageEntry! : item));
      else if (body.submission) setSubmissions(current => current.map(item => item.id === draft.id ? body.submission! : item));
      else throw new Error("The updated capture could not be confirmed. Refresh before trying again.");
      editDialogRef.current?.close(); setEditing(null);
    } catch (caught) { setEditError(caught instanceof Error ? caught.message : "Edits could not be saved. Keep this page open to retain them."); }
    finally { editSavingRef.current = false; setEditBusy(false); }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (selected.length === 0) return;
    const nextFiles = [...files, ...selected];
    const validationError = validateCaptureFiles(nextFiles);
    if (validationError) {
      setError(validationError);
      return;
    }
    setFiles(nextFiles);
    preparedBundleRef.current = null;
    setUploadNeedsAttention(false);
    setMessage(null);
    setError(null);
  }

  function removeSelectedFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    preparedBundleRef.current = null;
    setUploadNeedsAttention(false);
    setUploadProgress(null);
  }

  function moveSelectedFile(index: number, direction: -1 | 1) {
    setFiles((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    preparedBundleRef.current = null;
    setUploadNeedsAttention(false);
    setUploadProgress(null);
  }

  function chooseProperty(id: string) {
    setSelectedPropertyId(id);
    setSelectedUnitId("");
    setUnitLabel("");
    if (!id || id === MANUAL_CHOICE) {
      setPropertyLabel("");
      return;
    }
    setPropertyLabel(propertyCatalog.find((property) => property.id === id)?.label ?? "");
  }

  function chooseUnit(id: string) {
    setSelectedUnitId(id);
    if (!id || id === MANUAL_CHOICE) {
      setUnitLabel("");
      return;
    }
    const property = propertyCatalog.find((item) => item.id === selectedPropertyId);
    setUnitLabel(property?.units.find((unit) => unit.id === id)?.label ?? "");
  }

  function captureValidation() {
    if (captureKind === "mileage") {
      if (!propertyLabel.trim()) return "Choose the property for this trip.";
      if (!tripDate) return "Enter the trip date.";
      const miles = Number(businessMiles);
      if (!Number.isFinite(miles) || miles < 0.1 || miles > 1000) return "Enter business miles between 0.1 and 1,000.";
      if (!purpose.trim()) return "Add a short business purpose for this trip.";
    } else {
      if (!files.length) return captureKind === "maintenance" ? "Take a photo of the issue first." : "Take a receipt photo or choose a PDF first.";
      const fileError = validateCaptureFiles(files); if (fileError) return fileError;
      if (captureKind === "maintenance" && !propertyLabel.trim()) return "Choose or enter the property for this maintenance issue.";
      if (captureKind === "maintenance" && !maintenanceTitle.trim()) return "Add a short issue title.";
      if (captureKind === "maintenance" && !maintenanceLocation.trim()) return "Enter where the issue is located.";
      if (captureKind === "maintenance" && note.length > 280) return "Keep maintenance details to 280 characters. Your draft is still here.";
      if (captureKind === "maintenance" && !note.trim()) return "Add a short description of the maintenance issue.";
    }
    return null;
  }
  useEffect(() => {
    if (!reviewing) return;
    const previews = files.map((file) => file.type.startsWith("image/") ? URL.createObjectURL(file) : "");
    setReviewImages(previews);
    reviewDialogRef.current?.showModal();
    return () => { previews.filter(Boolean).forEach((url) => URL.revokeObjectURL(url)); };
  }, [reviewing, files]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingLock.current) return;
    const validation = captureValidation();
    if (validation) { setError(validation); return; }
    setError(null); setReviewing(true);
  }
  async function sendCapture() {
    if (savingLock.current) return;
    const validation = captureValidation(); if (validation) { setError(validation); return; }
    if (captureKind === "mileage") {
      await submitMileage();
      return;
    }
    if (files.length === 0) {
      setError(captureKind === "maintenance" ? "Take a photo of the issue first." : "Take a receipt photo or choose a PDF first.");
      return;
    }
    if (captureKind === "maintenance" && !propertyLabel.trim()) {
      setError("Choose or enter the property for this maintenance issue.");
      return;
    }
    if (captureKind === "maintenance" && !note.trim()) {
      setError("Add a short description of the maintenance issue.");
      return;
    }
    setSaving(true);
    savingLock.current = true;
    setError(null);
    setMessage(null);
    let chunkedPdf = false;
    setUploadNeedsAttention(false);

    try {
      const selectedFile = await prepareSelectedCapture(files, captureKind, preparedBundleRef, setUploadProgress);
      chunkedPdf = isChunkedPdf(selectedFile);
      const submission = chunkedPdf
        ? await uploadChunkedPdf(selectedFile)
        : await uploadStandardCapture(selectedFile);
      setSubmissions((current) => [submission, ...current]);
      setFiles([]);
      preparedBundleRef.current = null;
      setNote(""); setMaintenanceTitle(""); setMaintenanceLocation(""); setMaintenanceUrgency("Routine");
      delete memoryRef.current.drafts[captureKind]; persistMemory();
      setDraftMessage(null);
      setUploadNeedsAttention(false);
      setMessage(captureKind === "maintenance"
        ? "Maintenance report saved. Review it on the desktop to create or link a work order."
        : "Saved to your Mobile Inbox. It is ready on the desktop app.");
    } catch (caught) {
      setUploadNeedsAttention(true);
      setError(caught instanceof Error ? caught.message : "Capture could not be saved.");
    } finally {
      savingLock.current = false;
      setUploadProgress(null);
      setSaving(false);
    }
  }

  async function uploadStandardCapture(selectedFile: File): Promise<MobileSubmission> {
    const preparedFile = await prepareUploadFile(selectedFile);
    const hash = await sha256Hex(preparedFile);
    const identityKey = `${memoryKey}:upload:${captureKind}`;
    let identity = uploadIdentityRef.current;
    try { if (!identity) identity = JSON.parse(localStorage.getItem(identityKey) || "null"); } catch { /* The in-memory retry identity remains usable. */ }
    if (!identity || identity.hash !== hash || !/^[a-f0-9-]{36}$/.test(identity.id)) identity = { hash, id: crypto.randomUUID() };
    uploadIdentityRef.current = identity;
    try { localStorage.setItem(identityKey, JSON.stringify(identity)); } catch { /* File bytes are never retained here. */ }
    const form = new FormData();
    form.set("requestId", identity.id);
    form.set("file", preparedFile);
    form.set("kind", captureKind);
    form.set("propertyLabel", propertyLabel);
    form.set("unitLabel", unitLabel);
    form.set("note", captureKind === "maintenance" ? formatMaintenanceReport({ title: maintenanceTitle, location: maintenanceLocation, urgency: maintenanceUrgency, details: note }) : note);
    form.set("capturedAt", new Date().toISOString());
    const response = await fetch("/api/submissions", { method: "POST", body: form });
    const body = await readApiResponse<{ submission?: MobileSubmission } & ApiError>(response);
    if (!response.ok || !body.submission) throw new Error(body.error || "Capture could not be saved.");
    uploadIdentityRef.current = null;
    try { localStorage.removeItem(identityKey); } catch { /* A later confirmed retry is still idempotent. */ }
    return body.submission;
  }

  async function uploadChunkedPdf(selectedFile: File): Promise<MobileSubmission> {
    if (selectedFile.size > MAX_SELECTED_FILE_BYTES) throw new Error("Choose a PDF no larger than 15 MB.");
    setUploadProgress("Preparing PDF…");
    const sha256 = await sha256Hex(selectedFile);
    const chunkCount = Math.ceil(selectedFile.size / PDF_CHUNK_BYTES);
    const startResponse = await fetchWithRetries("/api/submissions/chunked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originalFileName: selectedFile.name,
        kind: captureKind,
        byteSize: selectedFile.size,
        chunkCount,
        sha256,
        propertyLabel,
        unitLabel,
        note: captureKind === "maintenance" ? formatMaintenanceReport({ title: maintenanceTitle, location: maintenanceLocation, urgency: maintenanceUrgency, details: note }) : note,
        capturedAt: new Date().toISOString(),
      }),
    }, { attempts: 3, onRetry: () => setUploadProgress("Reconnecting to resume PDF…") });
    const startBody = await readApiResponse<{
      uploadId?: string;
      chunkBytes?: number;
      receivedParts?: number[];
      resumed?: boolean;
    } & ApiError>(startResponse);
    if (!startResponse.ok || !startBody.uploadId) throw new Error(startBody.error || "The PDF upload could not start.");
    const uploadId = startBody.uploadId;
    const receivedParts = new Set(
      (startBody.receivedParts ?? []).filter((part) => Number.isInteger(part) && part >= 0 && part < chunkCount),
    );
    if (startBody.resumed && receivedParts.size > 0) {
      setUploadProgress(`Resuming PDF · ${receivedParts.size} of ${chunkCount} pieces already saved…`);
    }
    try {
      let completedParts = receivedParts.size;
      for (let partNumber = 0; partNumber < chunkCount; partNumber += 1) {
        if (receivedParts.has(partNumber)) continue;
        setUploadProgress(`Uploading PDF ${completedParts + 1} of ${chunkCount}…`);
        const start = partNumber * PDF_CHUNK_BYTES;
        const response = await fetchWithRetries(
          `/api/submissions/chunked/${encodeURIComponent(uploadId)}/${partNumber}`,
          {
            method: "PUT",
            headers: { "content-type": "application/octet-stream" },
            body: selectedFile.slice(start, Math.min(start + PDF_CHUNK_BYTES, selectedFile.size)),
          },
          {
            attempts: 3,
            onRetry: (attempt) => setUploadProgress(`Retrying PDF piece ${completedParts + 1} of ${chunkCount} · attempt ${attempt}…`),
          },
        );
        const body = await readApiResponse<ApiError>(response);
        if (!response.ok) throw new Error(body.error || `PDF piece ${partNumber + 1} could not be saved.`);
        completedParts += 1;
      }
      setUploadProgress("Finishing PDF…");
      const completeResponse = await fetchWithRetries(
        `/api/submissions/chunked/${encodeURIComponent(uploadId)}/complete`,
        { method: "POST" },
        { attempts: 3, onRetry: () => setUploadProgress("Reconnecting to finish PDF…") },
      );
      const completeBody = await readApiResponse<{ submission?: MobileSubmission } & ApiError>(completeResponse);
      if (!completeResponse.ok || !completeBody.submission) throw new Error(completeBody.error || "The PDF could not be completed.");
      return completeBody.submission;
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "The connection was interrupted.";
      throw new Error(`Upload paused. Keep this page open and tap Resume PDF upload. ${detail}`);
    }
  }

  async function submitMileage() {
    if (savingLock.current) return;
    const validation = captureValidation(); if (validation) { setError(validation); return; }
    const miles = Number(businessMiles);
    setSaving(true);
    savingLock.current = true;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/mileage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyLabel,
          unitLabel,
          tripDate,
          businessMiles: miles,
          purpose,
          startLocation,
          endLocation,
          note,
          capturedAt: new Date().toISOString(),
        }),
      });
      const body = (await response.json()) as { mileageEntry?: MobileMileageEntry } & ApiError;
      if (!response.ok || !body.mileageEntry) throw new Error(body.error || "Mileage entry could not be saved.");
      setMileageEntries((current) => [body.mileageEntry!, ...current]);
      memoryRef.current.recentPurposes = rememberPurpose(memoryRef.current.recentPurposes, purpose);
      setRecentPurposes(memoryRef.current.recentPurposes);
      setDrafts({ ...memoryRef.current.drafts });
      delete memoryRef.current.drafts.mileage; persistMemory(); setDraftMessage(null);
      setTripDate(localIsoDate());
      setBusinessMiles("");
      setPurpose("");
      setStartLocation("");
      setEndLocation("");
      setNote("");
      setMessage("Mileage entry saved. Review it on the desktop before it becomes an expense.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Mileage entry could not be saved.");
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  function resetScopeFields() {
    setSelectedPropertyId("");
    setSelectedUnitId("");
    setPropertyLabel("");
    setUnitLabel("");
  }

  async function removeSubmission(id: string) {
    setError(null);
    const response = await fetch(`/api/submissions/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      setError(body.error || "Capture could not be removed.");
      return;
    }
    setSubmissions((current) => current.filter((item) => item.id !== id));
  }

  async function removeMileageEntry(id: string) {
    setError(null);
    const response = await fetch(`/api/mileage/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ApiError;
      setError(body.error || "Mileage entry could not be removed.");
      return;
    }
    setMileageEntries((current) => current.filter((item) => item.id !== id));
  }

  async function saveRetentionPreference() {
    if (retentionChoice === 0 && (retentionOverview?.retainedImportedCount ?? 0) > 0) {
      const confirmed = window.confirm("Switch to immediate cleanup and remove the currently retained imported cloud files? Desktop copies are not affected.");
      if (!confirmed) return;
    }
    setRetentionBusy(true);
    setStorageMessage(null);
    try {
      const response = await fetch("/api/retention", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ retentionDays: retentionChoice }),
      });
      const body = await readApiResponse<{
        overview?: RetentionOverview;
        removedFiles?: number;
        removedBytes?: number;
      } & ApiError>(response);
      if (!response.ok || !body.overview) throw new Error(body.error || "Cloud retention could not be updated.");
      setRetentionOverview(body.overview);
      retentionEditing.current = false;
      setStorageMessage(body.removedFiles
        ? `Retention updated. ${body.removedFiles} imported cloud ${body.removedFiles === 1 ? "file was" : "files were"} removed.`
        : "Cloud retention preference saved.");
    } catch (caught) {
      setStorageMessage(caught instanceof Error ? caught.message : "Cloud retention could not be updated.");
    } finally {
      setRetentionBusy(false);
    }
  }

  async function clearImportedFiles() {
    if (!retentionOverview?.retainedImportedCount) return;
    const confirmed = window.confirm("Remove all imported companion files from cloud storage now? Desktop copies and minimal audit receipts remain.");
    if (!confirmed) return;
    setRetentionBusy(true);
    setStorageMessage(null);
    try {
      const response = await fetch("/api/retention", { method: "DELETE" });
      const body = await readApiResponse<{
        overview?: RetentionOverview;
        removedFiles?: number;
        removedBytes?: number;
      } & ApiError>(response);
      if (!response.ok || !body.overview) throw new Error(body.error || "Imported cloud files could not be cleared.");
      setRetentionOverview(body.overview);
      setStorageMessage(`${body.removedFiles ?? 0} imported cloud ${body.removedFiles === 1 ? "file was" : "files were"} removed. Desktop copies were not changed.`);
    } catch (caught) {
      setStorageMessage(caught instanceof Error ? caught.message : "Imported cloud files could not be cleared.");
    } finally {
      setRetentionBusy(false);
    }
  }

  const pendingCount = submissions.filter((item) => item.status !== "imported").length + mileageEntries.filter((item) => item.status !== "imported").length;
  const selectedBytes = files.reduce((total, selectedFile) => total + selectedFile.size, 0);
  const hasSelectedPdf = files.length === 1 && isPdfFile(files[0]);
  const showsResumableUpload = files.length > 1 || hasSelectedPdf && isChunkedPdf(files[0]);
  const canAddPage = !hasSelectedPdf && files.length < MAX_CAPTURE_PAGES;
  const canResumePreparedUpload = uploadNeedsAttention && files.length > 0;
  const selectedProperty = propertyCatalog.find((property) => property.id === selectedPropertyId) ?? null;
  const usePropertyChoices = propertyCatalog.length > 0;
  const useUnitChoices = Boolean(selectedProperty?.units.length);
  const queueItems = [
    ...submissions.map((submission) => ({ recordType: "capture" as const, createdAt: submission.createdAt, submission })),
    ...mileageEntries.map((mileageEntry) => ({ recordType: "mileage" as const, createdAt: mileageEntry.createdAt, mileageEntry })),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">R</div>
        <div className="brand-copy">
          <span>Rental Tracker</span>
          <strong>Companion</strong>
        </div>
        <div className="account">
          <span title={displayName}>{initials(displayName)}</span>
          {signOutPath ? <a href={signOutPath}>Sign out</a> : null}
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">{screen === "capture" ? "FIELD CAPTURE" : screen === "inbox" ? "PHONE → DESKTOP" : "YOUR COMPANION"}</p>
        <h1>{screen === "capture" ? "Capture it now. Finish it at your desk." : screen === "inbox" ? "Your capture inbox" : "Settings"}</h1>
        <p>{screen === "capture" ? "Send receipts, maintenance photos, and business mileage while the details are fresh." : screen === "inbox" ? "Track what is waiting for review and what your desktop has imported." : "Manage your connection, saved drafts, and private cloud storage."}</p>
      </section>

      <nav className="workspace-nav" aria-label="Companion sections">
        {(["capture", "inbox", "settings"] as const).map((tab) => <button type="button" key={tab} aria-current={screen === tab ? "page" : undefined} onClick={() => setScreen(tab)}>{tab === "capture" ? "Capture" : tab === "inbox" ? `Inbox${pendingCount ? ` · ${pendingCount}` : ""}` : "Settings"}</button>)}
      </nav>
      <div className="connection-strip" role="status"><span>{!online ? "Offline · keep selected files open" : syncError ? "Sync needs attention" : lastSync ? `Updated ${new Date(lastSync).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Connecting to your inbox…"}</span><button type="button" onClick={() => void loadData()}>Refresh</button></div>
      {syncError && <p className="alert error" role="alert">{syncError} Your unfinished capture is still here.</p>}

      <section hidden={screen !== "capture"} className="capture-card" aria-labelledby="capture-title">
        <div className="section-heading">
          <div>
            <p className="step-label">QUICK CAPTURE</p>
            <h2 id="capture-title">{captureKind === "maintenance" ? "Report maintenance" : captureKind === "mileage" ? "Log business mileage" : "Add a receipt"}</h2>
          </div>
          <span className="time-chip">Phone → Desktop</span>
        </div>

        <form onSubmit={submit}>
          <fieldset disabled={saving || !memoryReady}>
          <div className="capture-kind" role="group" aria-label="Capture type">
            <button
              type="button"
              className={captureKind === "receipt" ? "active" : ""}
              aria-pressed={captureKind === "receipt"}
              onClick={() => changeCaptureKind("receipt")}
            >
              <strong>Receipt</strong>
              <span>Expense or bill</span>
            </button>
            <button
              type="button"
              className={captureKind === "maintenance" ? "active" : ""}
              aria-pressed={captureKind === "maintenance"}
              onClick={() => changeCaptureKind("maintenance")}
            >
              <strong>Maintenance</strong>
              <span>Issue or repair photo</span>
            </button>
            <button
              type="button"
              className={captureKind === "mileage" ? "active" : ""}
              aria-pressed={captureKind === "mileage"}
              disabled={!usePropertyChoices}
              title={usePropertyChoices ? "Log business mileage" : "Open Mobile Inbox once in the updated desktop app to enable mileage capture."}
              onClick={() => changeCaptureKind("mileage")}
            >
              <strong>Mileage</strong>
              <span>{usePropertyChoices ? "Business trip" : "Desktop sync needed"}</span>
            </button>
          </div>
          {draftMessage && <p className="draft-notice" role="status">{draftMessage}</p>}
          <p className="draft-hint">Text drafts save on this phone. After reopening, reselect photos or your PDF to resume an upload.</p>
          {(hasDraftContent(currentDraft) || files.length > 0) && <button className="text-button" type="button" onClick={() => clearDraft(captureKind)}>Discard unfinished capture</button>}

          {captureKind !== "mileage" ? <>
          <label className={`file-drop ${files.length > 0 ? "has-file" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              multiple
              disabled={!canAddPage && files.length > 0}
              onChange={chooseFile}
            />
            <span className="camera-glyph" aria-hidden="true">+</span>
            <strong>{files.length > 0 && canAddPage ? "Add another page" : files.length > 1 ? `${files.length} photos selected` : files[0]?.name || (captureKind === "maintenance" ? "Take issue photo" : "Take photo or choose file")}</strong>
            <small>{files.length > 0 ? `${files.length} ${files.length === 1 ? "file" : "pages"} · ${formatBytes(selectedBytes)} selected` : captureKind === "maintenance" ? "Add up to 8 JPEG or PNG photos" : "Add up to 8 photos as one PDF · single PDFs up to 15 MB"}</small>
          </label>
          {files.length > 0 ? (
            <div className="selected-pages" aria-label="Selected document pages">
              {files.map((selectedFile, index) => (
                <div className="selected-page" key={`${selectedFile.name}-${selectedFile.lastModified}-${index}`}>
                  <span className="selected-page-number">{isPdfFile(selectedFile) ? "PDF" : index + 1}</span>
                  <span className="selected-page-copy">
                    <strong>{selectedFile.name}</strong>
                    <small>{formatBytes(selectedFile.size)}{files.length > 1 ? ` · Page ${index + 1}` : ""}</small>
                  </span>
                  {files.length > 1 ? <span className="page-order-actions">
                    <button type="button" onClick={() => moveSelectedFile(index, -1)} disabled={index === 0} aria-label={`Move ${selectedFile.name} earlier`}>↑</button>
                    <button type="button" onClick={() => moveSelectedFile(index, 1)} disabled={index === files.length - 1} aria-label={`Move ${selectedFile.name} later`}>↓</button>
                  </span> : null}
                  <button className="remove-page" type="button" onClick={() => removeSelectedFile(index)}>Remove</button>
                </div>
              ))}
            </div>
          ) : null}
          </> : (
            <div className="mileage-fields">
              <div className="form-grid">
                <label>
                  <span>Trip date</span>
                  <input type="date" value={tripDate} onChange={(event) => setTripDate(event.target.value)} />
                </label>
                <label>
                  <span>Business miles</span>
                  <input type="number" min="0.1" max="1000" step="0.1" inputMode="decimal" value={businessMiles} onChange={(event) => setBusinessMiles(event.target.value)} placeholder="e.g. 18.4" />
                </label>
              </div>
              <label className="note-field">
                <span>Business purpose <em>required</em></span>
                <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="e.g. Property inspection and hardware pickup" maxLength={200} />
              </label>
              {recentPurposes.length > 0 && <div className="purpose-shortcuts" aria-label="Recent business purposes">{recentPurposes.map((item) => <button type="button" key={item} onClick={() => setPurpose(item)}>{item}</button>)}</div>}
              <div className="form-grid route-grid">
                <label>
                  <span>From <em>optional</em></span>
                  <input value={startLocation} onChange={(event) => setStartLocation(event.target.value)} placeholder="Starting place" maxLength={160} />
                </label>
                <label>
                  <span>To <em>optional</em></span>
                  <input value={endLocation} onChange={(event) => setEndLocation(event.target.value)} placeholder="Destination" maxLength={160} />
                </label>
              </div>
            </div>
          )}

          {showsResumableUpload ? (
            <div className={`upload-state ${uploadNeedsAttention ? "needs-attention" : saving ? "uploading" : "waiting"}`} role="status">
              <strong>{uploadNeedsAttention ? "Needs attention" : saving ? "Uploading" : "Waiting to upload"}</strong>
              <span>{uploadNeedsAttention ? "Tap Resume document upload. Saved pieces will not be sent again." : saving ? uploadProgress || "Preparing secure upload…" : files.length > 1 ? "Photos are combined on this phone into one PDF. Larger bundles resume automatically." : "Large PDFs upload in resumable private pieces."}</span>
            </div>
          ) : null}

          <div className="form-grid">
            <label>
              <span>Property {captureKind === "receipt" ? <em>optional</em> : <em>required</em>}</span>
              {usePropertyChoices ? (
                <>
                  <select value={selectedPropertyId} onChange={(event) => chooseProperty(event.target.value)}>
                    <option value="">Choose a property</option>
                    {propertyCatalog.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.label}{property.addressLabel ? ` — ${property.addressLabel}` : ""}
                      </option>
                    ))}
                    <option value={MANUAL_CHOICE}>Enter manually</option>
                  </select>
                  {selectedPropertyId === MANUAL_CHOICE ? (
                    <input
                      value={propertyLabel}
                      onChange={(event) => setPropertyLabel(event.target.value)}
                      placeholder="Property name"
                      maxLength={120}
                    />
                  ) : null}
                </>
              ) : (
                <input
                  value={propertyLabel}
                  onChange={(event) => setPropertyLabel(event.target.value)}
                  placeholder="e.g. Oak Street Duplex"
                  maxLength={120}
                />
              )}
            </label>
            <label>
              <span>Unit <em>optional</em></span>
              {useUnitChoices ? (
                <>
                  <select value={selectedUnitId} onChange={(event) => chooseUnit(event.target.value)}>
                    <option value="">Shared / no unit</option>
                    {selectedProperty?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
                    <option value={MANUAL_CHOICE}>Enter manually</option>
                  </select>
                  {selectedUnitId === MANUAL_CHOICE ? (
                    <input
                      value={unitLabel}
                      onChange={(event) => setUnitLabel(event.target.value)}
                      placeholder="Unit name"
                      maxLength={80}
                    />
                  ) : null}
                </>
              ) : (
                <input
                  value={unitLabel}
                  onChange={(event) => setUnitLabel(event.target.value)}
                  placeholder="e.g. Unit 2"
                  maxLength={80}
                />
              )}
            </label>
          </div>

          {captureKind === "maintenance" && <div className="maintenance-fields"><label><span>Issue title</span><input value={maintenanceTitle} onChange={event => setMaintenanceTitle(event.target.value)} maxLength={80} placeholder="e.g. Kitchen sink leak" /></label><label><span>Issue location</span><input value={maintenanceLocation} onChange={event => setMaintenanceLocation(event.target.value)} maxLength={80} placeholder="e.g. Under the kitchen sink" /></label><label><span>Urgency</span><select value={maintenanceUrgency} onChange={event => setMaintenanceUrgency(event.target.value as MaintenanceReport["urgency"])}><option>Routine</option><option>Soon</option><option>Urgent</option></select></label><p className="draft-hint">Urgency is for desktop review. Sending a report does not notify a contractor.</p></div>}
          <label className="note-field">
            <span>{captureKind === "maintenance" ? "Issue details" : captureKind === "mileage" ? "Trip note" : "Note"} {captureKind === "maintenance" ? <em>required</em> : <em>optional</em>}</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={captureKind === "maintenance" ? "What is happening, where is it, and when did it start?" : captureKind === "mileage" ? "Parking, toll, or other detail to remember" : "What was this for?"}
              rows={2}
              maxLength={captureKind === "maintenance" ? 280 : 500}
            />
          </label>

          {error ? <p className="alert error" role="alert">{error}</p> : null}
          {message ? <p className="alert success" role="status">{message}</p> : null}
          {message && <button className="secondary-button" type="button" onClick={() => { setMessage(null); fileInputRef.current?.focus(); document.getElementById("capture-title")?.scrollIntoView({ block: "start" }); }}>Capture another</button>}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? uploadProgress || "Saving securely…" : canResumePreparedUpload ? "Review upload retry" : "Review capture"}
          </button>
          </fieldset>
        </form>
      </section>

      <dialog className="capture-review" ref={reviewDialogRef} aria-labelledby="review-title" onClose={() => setReviewing(false)}>
        <p className="step-label">CHECK BEFORE SENDING</p>
        <h2 id="review-title">Review {captureKind === "mileage" ? "mileage" : captureKind === "maintenance" ? "maintenance report" : "receipt"}</h2>
        <p className="review-intro">Check the details below. Nothing is sent until you confirm.</p>
        <dl className="review-details"><div><dt>Property</dt><dd>{propertyLabel || "Not assigned · choose on desktop"}</dd></div><div><dt>Unit</dt><dd>{unitLabel || "Not assigned"}</dd></div>
          {captureKind === "mileage" && <><div><dt>Trip date</dt><dd>{formatTripDate(tripDate)}</dd></div><div><dt>Business mileage</dt><dd>{businessMiles} miles</dd></div><div><dt>Purpose</dt><dd>{purpose}</dd></div>{(startLocation || endLocation) && <div><dt>Route</dt><dd>{startLocation || "Start not entered"} → {endLocation || "End not entered"}</dd></div>}</>}
          {captureKind === "maintenance" && <><div><dt>Issue</dt><dd>{maintenanceTitle}</dd></div><div><dt>Location</dt><dd>{maintenanceLocation}</dd></div><div><dt>Urgency</dt><dd>{maintenanceUrgency}</dd></div></>}
          <div><dt>{captureKind === "maintenance" ? "Issue details" : "Note"}</dt><dd>{note || "No note added"}</dd></div>
        </dl>
        {captureKind !== "mileage" && <section aria-label="Files in sending order"><h3>{files.length > 1 ? "Pages in sending order" : "Selected file"}</h3><ol className="review-files">{files.map((file, index) => <li key={`${file.name}-${index}`}>{reviewImages[index] && <img src={reviewImages[index]} alt={`Preview of page ${index + 1}`} />}<div><strong>{file.name}</strong><span>{formatBytes(file.size)}{files.length > 1 ? ` · Page ${index + 1}` : ""}</span></div></li>)}</ol>{files.length > 1 && <p className="draft-hint">These photos will be combined into one PDF in this order. Use Back to edit to reorder or remove pages.</p>}</section>}
        <p className="draft-hint">The desktop will review this capture before accounting or work-order decisions.</p>
        <div className="review-actions"><button className="secondary-button" type="button" onClick={() => reviewDialogRef.current?.close()}>Back to edit</button><button className="primary-button" type="button" disabled={saving} onClick={() => { reviewDialogRef.current?.close(); void sendCapture(); }}>{captureKind === "mileage" ? "Send mileage to desktop" : captureKind === "maintenance" ? "Send maintenance report" : "Send to Mobile Inbox"}</button></div>
      </dialog>

      <dialog className="capture-review" ref={editDialogRef} aria-labelledby="edit-title" onCancel={event => { if (editBusy) event.preventDefault(); }} onClose={() => setEditing(null)}>
        {editing && <form onSubmit={savePendingEdit}><p className="step-label">BEFORE DESKTOP PICKUP</p><h2 id="edit-title">Edit {editing.kind === "maintenance" ? "maintenance report" : editing.kind === "mileage" ? "trip" : "receipt"}</h2><p className="review-intro">Update details while this item is Sent. The original file stays attached. Desktop pickup locks editing.</p><fieldset disabled={editBusy} className="edit-fields">
          <label><span>Property</span><input list="edit-property-choices" value={editing.propertyLabel} maxLength={120} onChange={event => setEditing({ ...editing, propertyLabel: event.target.value })} required={editing.kind !== "receipt"} /></label>
          <datalist id="edit-property-choices">{propertyCatalog.map(property => <option value={property.label} key={property.id} />)}</datalist>
          <label><span>Unit</span><input value={editing.unitLabel} maxLength={80} onChange={event => setEditing({ ...editing, unitLabel: event.target.value })} /></label>
          {editing.kind === "maintenance" && <><label><span>Issue title</span><input value={editing.maintenanceTitle} maxLength={80} required onChange={event => setEditing({ ...editing, maintenanceTitle: event.target.value })} /></label><label><span>Issue location</span><input value={editing.maintenanceLocation} maxLength={80} required onChange={event => setEditing({ ...editing, maintenanceLocation: event.target.value })} /></label><label><span>Urgency</span><select value={editing.maintenanceUrgency} onChange={event => setEditing({ ...editing, maintenanceUrgency: event.target.value as MaintenanceReport["urgency"] })}><option>Routine</option><option>Soon</option><option>Urgent</option></select></label></>}
          {editing.kind === "mileage" && <><label><span>Trip date</span><input type="date" value={editing.tripDate} required onChange={event => setEditing({ ...editing, tripDate: event.target.value })} /></label><label><span>Business miles</span><input type="number" min="0.1" max="1000" step="0.1" value={editing.businessMiles} required onChange={event => setEditing({ ...editing, businessMiles: event.target.value })} /></label><label><span>Purpose</span><input value={editing.purpose} maxLength={200} required onChange={event => setEditing({ ...editing, purpose: event.target.value })} /></label><label><span>Start location</span><input value={editing.startLocation} maxLength={160} onChange={event => setEditing({ ...editing, startLocation: event.target.value })} /></label><label><span>End location</span><input value={editing.endLocation} maxLength={160} onChange={event => setEditing({ ...editing, endLocation: event.target.value })} /></label></>}
          <label><span>{editing.kind === "maintenance" ? "Issue details" : "Note"}</span><textarea value={editing.note} maxLength={editing.kind === "maintenance" ? 280 : 500} required={editing.kind === "maintenance"} onChange={event => setEditing({ ...editing, note: event.target.value })} rows={3} /></label>
          {editError && <p className="alert error" role="alert">{editError}</p>}<div className="review-actions"><button className="secondary-button" type="button" onClick={() => editDialogRef.current?.close()}>Cancel</button><button className="primary-button" type="submit">{editBusy ? "Saving…" : "Save changes"}</button></div>
        </fieldset></form>}
      </dialog>

      <section hidden={screen !== "inbox"} className="queue-section" aria-labelledby="queue-title">
        <div className="section-heading queue-heading">
          <div>
            <p className="step-label">DESKTOP HANDOFF</p>
            <h2 id="queue-title">Mobile Inbox</h2>
          </div>
          <span className="count-badge">{pendingCount}</span>
        </div>
        <p className="handoff-help">Sent → Awaiting review → Imported. Import confirmation means the desktop has saved a copy; accounting still requires desktop review.</p>

        {loading ? <p className="empty-state">Checking your inbox…</p> : null}
        {!loading && queueItems.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing waiting</strong>
            <span>Your next capture will appear here and in the desktop app.</span>
          </div>
        ) : null}
        <div className="queue-list">
          {queueItems.map((item) => item.recordType === "capture" ? (
              <article className="queue-item" key={item.submission.id}>
                <div className="file-kind" aria-hidden="true">
                  {item.submission.kind === "maintenance" ? "FIX" : item.submission.contentType === "application/pdf" ? "PDF" : "IMG"}
                </div>
                <div className="queue-copy">
                  <strong>{item.submission.kind === "maintenance" ? parseMaintenanceReport(item.submission.note)?.title || "Maintenance report" : item.submission.originalFileName}</strong>
                  <span>{item.submission.propertyLabel || "Property not assigned"}{item.submission.unitLabel ? ` · ${item.submission.unitLabel}` : ""}</span>
                  <small>{relativeTime(item.submission.createdAt)} · {item.submission.status === "imported" ? "Imported · saved on desktop" : item.submission.status === "claimed" ? "Awaiting review · opened on desktop" : "Sent · ready for desktop"}</small>
                </div>
                {item.submission.status === "pending" && <button className="text-button" type="button" onClick={() => beginEdit(item.submission, "capture")}>Edit</button>}
                {item.submission.status === "pending" ? (
                  <button className="text-button" type="button" onClick={() => void removeSubmission(item.submission.id)}>Remove</button>
                ) : <span className="claimed-dot" title="Opened on desktop" />}
              </article>
            ) : (
              <article className="queue-item" key={item.mileageEntry.id}>
                <div className="file-kind" aria-hidden="true">MI</div>
                <div className="queue-copy">
                  <strong>{item.mileageEntry.purpose}</strong>
                  <span>{item.mileageEntry.propertyLabel}{item.mileageEntry.unitLabel ? ` · ${item.mileageEntry.unitLabel}` : ""}</span>
                  <small>{item.mileageEntry.businessMiles} mi · {formatTripDate(item.mileageEntry.tripDate)} · {item.mileageEntry.status === "claimed" ? "Awaiting review · opened on desktop" : "Sent · ready for desktop"}</small>
                </div>
                {item.mileageEntry.status === "pending" && <button className="text-button" type="button" onClick={() => beginEdit(item.mileageEntry, "mileage")}>Edit</button>}
                {item.mileageEntry.status === "pending" ? (
                  <button className="text-button" type="button" onClick={() => void removeMileageEntry(item.mileageEntry.id)}>Remove</button>
                ) : <span className="claimed-dot" title="Opened on desktop" />}
              </article>
            ))}
        </div>
        {importedReceipts.length > 0 && <section className="import-confirmations" aria-label="Recent desktop imports"><h3>Recently imported</h3><p>Confirmed by your desktop. File cleanup does not remove this confirmation.</p>{importedReceipts.map((receipt) => <div key={receipt.id} className="import-confirmation"><strong>{receipt.kind === "mileage" ? "Mileage" : receipt.kind === "maintenance" ? "Maintenance report" : "Receipt"}</strong><span>Captured {formatConfirmationDate(receipt.capturedAt || receipt.importedAt)} · Ref {receipt.id.slice(-8).toUpperCase()}</span><small>Imported {formatConfirmationDate(receipt.importedAt)} · {relativeTime(receipt.importedAt)}</small></div>)}</section>}
      </section>

      <section hidden={screen !== "settings"} className="settings-panel" aria-labelledby="connection-title">
        <p className="step-label">DESKTOP CONNECTION</p><h2 id="connection-title">Property sync</h2>
        <p>{catalogError || (usePropertyChoices ? `${propertyCatalog.length} ${propertyCatalog.length === 1 ? "property" : "properties"} available from your desktop.` : "No property choices have arrived yet. Manual entry is available for receipts and maintenance.")}</p>
        <dl className="connection-details"><div><dt>Desktop supplied choices</dt><dd>{catalogUpdatedAt ? formatConfirmationDate(catalogUpdatedAt) : "Not available yet"}</dd></div><div><dt>Companion refreshed</dt><dd>{lastSync ? formatConfirmationDate(lastSync) : "Waiting for a successful refresh"}</dd></div></dl>
        <button className="secondary-button" type="button" onClick={() => void loadData()}>Refresh connection</button>
        <p className="draft-hint">This shows property sync history, not whether your desktop is currently running. Mileage needs synced property choices.</p>
      </section>
      <section hidden={screen !== "settings"} className="settings-panel" aria-labelledby="drafts-title">
        <p className="step-label">ON THIS DEVICE</p><h2 id="drafts-title">Saved drafts</h2>
        <p>Text stays in this browser for your account. Photos and PDFs must be selected again after reopening.</p>
        {(["receipt", "maintenance", "mileage"] as const).filter((kind) => drafts[kind]).map((kind) => <article className="saved-draft" key={kind}><div><strong>{kind === "mileage" ? "Mileage" : kind === "maintenance" ? "Maintenance" : "Receipt"} draft</strong><span>{drafts[kind]?.propertyLabel || "Property not selected"}{drafts[kind]?.unitLabel ? ` · ${drafts[kind]?.unitLabel}` : ""}</span><small>{drafts[kind]?.purpose || drafts[kind]?.note || "Unfinished capture"}</small></div><div className="draft-actions"><button className="secondary-button" type="button" disabled={saving} onClick={() => resumeDraft(kind)}>Resume</button><button className="text-button" type="button" disabled={saving} onClick={() => clearDraft(kind)}>Clear</button></div></article>)}
        {!Object.keys(drafts).length && <p className="draft-hint">No saved text drafts on this device.</p>}
        {draftMessage && <p className="draft-notice" role="status">{draftMessage}</p>}
      </section>
      <section hidden={screen !== "settings"} className="storage-section" aria-labelledby="storage-title">
        <div className="section-heading">
          <div>
            <p className="step-label">PRIVACY &amp; STORAGE</p>
            <h2 id="storage-title">Cloud cleanup</h2>
          </div>
          <span className="time-chip">Automatic</span>
        </div>
        <p className="storage-intro">Desktop imports are the durable copy. Choose how long an imported companion file remains in private cloud storage.</p>
        <div className="retention-controls">
          <label>
            <span>Keep imported cloud files</span>
            <select value={retentionChoice} onChange={(event) => { retentionEditing.current = true; setRetentionChoice(Number(event.target.value) as 0 | 7 | 30); }} disabled={retentionBusy}>
              <option value={0}>Remove immediately after import</option>
              <option value={7}>Keep for 7 days</option>
              <option value={30}>Keep for 30 days</option>
            </select>
          </label>
          <button className="secondary-button" type="button" onClick={() => void saveRetentionPreference()} disabled={retentionBusy || !retentionOverview}>
            {retentionBusy ? "Updating…" : "Save retention"}
          </button>
        </div>
        <p className="retention-copy">{retentionPolicyCopy(retentionOverview?.retentionDays ?? retentionChoice)}</p>
        <div className="storage-grid">
          <div><strong>{retentionOverview?.waitingCount ?? 0}</strong><span>Waiting · {formatBytes(retentionOverview?.waitingBytes ?? 0)}</span></div>
          <div><strong>{retentionOverview?.retainedImportedCount ?? 0}</strong><span>Imported retained · {formatBytes(retentionOverview?.retainedImportedBytes ?? 0)}</span></div>
          <div><strong>{retentionOverview?.stagedUploadCount ?? 0}</strong><span>Unfinished uploads · {formatBytes(retentionOverview?.stagedUploadBytes ?? 0)}</span></div>
        </div>
        <div className="storage-actions">
          <span>{retentionOverview?.auditReceiptCount ?? 0} minimal audit receipts retained. Unfinished upload pieces expire after 48 hours.</span>
          <button className="text-button" type="button" onClick={() => void clearImportedFiles()} disabled={retentionBusy || !retentionOverview?.retainedImportedCount}>Clear imported cloud files</button>
        </div>
        {storageMessage ? <p className="storage-message" role="status">{storageMessage}</p> : null}
        <p className="phone-storage-note">Selected files stay only in this page&apos;s memory while uploading; the companion does not create a permanent offline document cache on your phone.</p>
      </section>

      <section hidden={screen !== "settings"} className="settings-panel" aria-labelledby="help-title">
        <p className="step-label">HELP &amp; ABOUT</p><h2 id="help-title">Using your companion</h2>
        <details><summary>Connect your desktop</summary><p>In Rental Tracker on your computer, open Settings → Mobile companion. Enable the companion and complete pairing there using this site’s address. Keep pairing credentials on your computer. Refresh here after the desktop syncs property choices.</p></details>
        <details><summary>Recover an interrupted upload</summary><p>Keep this page open and retry when your connection returns. After reopening, resume your text draft and reselect the original files. Send the same capture again to retry it; standard uploads reuse their retry reference.</p></details>
        <details><summary>Understand Inbox status</summary><p>Sent means ready for the desktop. Awaiting review means the desktop opened it. Imported confirms a saved desktop copy; accounting decisions still happen on your desktop.</p></details>
        <details><summary>Drafts and privacy</summary><p>Draft text is stored in this browser for your account and can be cleared above. Sent files use private cloud storage. Cloud cleanup applies after desktop import and keeps a minimal confirmation.</p></details>
        <p className="draft-hint">Rental Tracker Companion · Version {companionVersion}</p>
      </section>

      <footer>Desktop remains the system of record · Files are private</footer>
    </main>
  );
}

async function readApiResponse<T extends ApiError>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) return (await response.json()) as T;

  const message = (await response.text()).trim();
  if (response.status === 413 || /payload too large/i.test(message)) {
    throw new Error("This file is still too large to send. Try a smaller photo or use Documents on the desktop.");
  }
  throw new Error(message || `The companion could not complete the upload (${response.status}).`);
}

async function fetchWithRetries(
  input: RequestInfo | URL,
  init: RequestInit,
  options: { attempts: number; onRetry?: (nextAttempt: number) => void },
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (response.ok || !retryable || attempt === options.attempts) return response;
      lastError = new Error(`The companion returned ${response.status}.`);
    } catch (caught) {
      lastError = caught;
      if (attempt === options.attempts) break;
    }
    options.onRetry?.(attempt + 1);
    await new Promise((resolve) => window.setTimeout(resolve, 450 * attempt));
  }
  throw lastError instanceof Error ? lastError : new Error("The connection was interrupted.");
}

function validateCaptureFiles(files: File[]): string | null {
  if (files.length > MAX_CAPTURE_PAGES) return `Choose no more than ${MAX_CAPTURE_PAGES} photos for one document.`;
  const pdfCount = files.filter(isPdfFile).length;
  if (pdfCount > 0 && files.length > 1) return "Send a PDF by itself, or choose photos to combine into a new PDF.";
  let totalBytes = 0;
  for (const selectedFile of files) {
    if (!isPdfFile(selectedFile) && selectedFile.type !== "image/jpeg" && selectedFile.type !== "image/png") {
      return "Use JPEG or PNG photos, or one PDF file.";
    }
    if (selectedFile.size <= 0) return `${selectedFile.name || "A selected file"} is empty.`;
    if (selectedFile.size > MAX_SELECTED_FILE_BYTES) return `${selectedFile.name} is larger than 15 MB.`;
    totalBytes += selectedFile.size;
  }
  if (files.length > 1 && totalBytes > MAX_MULTI_PHOTO_SOURCE_BYTES) {
    return "These photos use more than 60 MB before preparation. Choose fewer pages or smaller photos.";
  }
  return null;
}

async function prepareSelectedCapture(
  files: File[],
  captureKind: Exclude<CaptureKind, "mileage">,
  preparedBundleRef: { current: { signature: string; file: File } | null },
  setProgress: (message: string | null) => void,
): Promise<File> {
  const validationError = validateCaptureFiles(files);
  if (validationError) throw new Error(validationError);
  if (files.length === 1) return files[0];

  const signature = `${captureKind}|${files.map((selectedFile) => `${selectedFile.name}:${selectedFile.size}:${selectedFile.lastModified}`).join("|")}`;
  if (preparedBundleRef.current?.signature === signature) return preparedBundleRef.current.file;

  const pages: PreparedPdfPage[] = [];
  for (let index = 0; index < files.length; index += 1) {
    setProgress(`Preparing page ${index + 1} of ${files.length}…`);
    pages.push(await preparePdfPage(files[index]));
  }
  const pdfBytes = buildJpegPagesPdf(pages);
  const bundle = new File(
    [pdfBytes],
    `${captureKind === "maintenance" ? "maintenance" : "receipt"}-pages-${localIsoDate()}.pdf`,
    { type: "application/pdf", lastModified: Date.now() },
  );
  if (bundle.size > MAX_SELECTED_FILE_BYTES) {
    throw new Error("The combined PDF is larger than 15 MB. Remove a page or send it from Documents on the desktop.");
  }
  preparedBundleRef.current = { signature, file: bundle };
  return bundle;
}

async function preparePdfPage(file: File): Promise<PreparedPdfPage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name} could not be opened. Choose it from your gallery or use a screenshot instead.`);
  }
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * initialScale));
    height = Math.max(1, Math.round(height * initialScale));

    for (let attempt = 0; attempt < 7; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("A document page could not be prepared.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const quality = Math.max(0.54, 0.84 - attempt * 0.05);
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= TARGET_UPLOAD_BYTES || Math.max(width, height) <= 900) {
        return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
      }
      const reduction = Math.min(0.88, Math.sqrt(TARGET_UPLOAD_BYTES / blob.size) * 0.94);
      width = Math.max(1, Math.round(width * reduction));
      height = Math.max(1, Math.round(height * reduction));
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`${file.name} could not be prepared. Try a screenshot or remove that page.`);
}

async function prepareUploadFile(file: File): Promise<File> {
  if (file.size > MAX_SELECTED_FILE_BYTES) {
    throw new Error("Choose a photo or PDF no larger than 15 MB.");
  }
  if (file.size <= TARGET_UPLOAD_BYTES) {
    return isPdfFile(file) && file.type !== "application/pdf"
      ? new File([file], file.name, { type: "application/pdf", lastModified: file.lastModified })
      : file;
  }
  if (isPdfFile(file)) {
    throw new Error("This PDF is too large for mobile capture. Add it from Documents on the desktop instead.");
  }
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    throw new Error("Use a JPEG, PNG, or PDF file.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This photo could not be opened. Choose it from your gallery or send a screenshot instead.");
  }
  try {
    let width = bitmap.width;
    let height = bitmap.height;
    const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(width, height));
    width = Math.max(1, Math.round(width * initialScale));
    height = Math.max(1, Math.round(height * initialScale));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This photo could not be prepared for upload.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      const quality = Math.max(0.58, 0.86 - attempt * 0.06);
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= TARGET_UPLOAD_BYTES) {
        return new File([blob], jpegFileName(file.name), {
          type: "image/jpeg",
          lastModified: file.lastModified,
        });
      }

      const reduction = Math.min(0.88, Math.sqrt(TARGET_UPLOAD_BYTES / blob.size) * 0.94);
      if (Math.max(width, height) <= 1000) break;
      width = Math.max(1, Math.round(width * reduction));
      height = Math.max(1, Math.round(height * reduction));
    }
  } finally {
    bitmap.close();
  }

  throw new Error("This photo could not be reduced enough. Try a screenshot or add it from Documents on the desktop.");
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isChunkedPdf(file: File): boolean {
  return isPdfFile(file) && file.size > TARGET_UPLOAD_BYTES;
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("This photo could not be prepared for upload.")),
      "image/jpeg",
      quality,
    );
  });
}

function jpegFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") || "receipt";
  return `${base}.jpg`;
}

function initials(value: string): string {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "RT";
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function retentionPolicyCopy(retentionDays: 0 | 7 | 30): string {
  if (retentionDays === 0) return "Imported file bytes are removed as soon as the desktop confirms import.";
  return `Imported file bytes are removed on the first companion or desktop check after ${retentionDays} days.`;
}

function relativeTime(iso: string): string {
  const elapsed = Math.max(0, Date.now() - Date.parse(iso));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function localIsoDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatTripDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parsed)
    : value;
}

function formatConfirmationDate(value: string) {
 const date = new Date(value);
 return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
