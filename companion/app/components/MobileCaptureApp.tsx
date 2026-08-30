"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { MobileMileageEntry } from "@/lib/mileage";
import type { PropertyCatalogItem } from "@/lib/property-catalog";
import type { MobileSubmission } from "@/lib/submissions";

type Props = {
  displayName: string;
  signOutPath: string | null;
};

type ApiError = { error?: string };
type CaptureKind = "receipt" | "maintenance" | "mileage";

const MAX_SELECTED_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 700 * 1024;
const PDF_CHUNK_BYTES = 512 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const MANUAL_CHOICE = "__manual__";

export function MobileCaptureApp({ displayName, signOutPath }: Props) {
  const [submissions, setSubmissions] = useState<MobileSubmission[]>([]);
  const [mileageEntries, setMileageEntries] = useState<MobileMileageEntry[]>([]);
  const [propertyCatalog, setPropertyCatalog] = useState<PropertyCatalogItem[]>([]);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("receipt");
  const [file, setFile] = useState<File | null>(null);
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
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
        const catalogBody = (await catalogResponse.json()) as { properties?: PropertyCatalogItem[] };
        setPropertyCatalog(Array.isArray(catalogBody.properties) ? catalogBody.properties : []);
      } else {
        setPropertyCatalog([]);
      }
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your captures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setMessage(null);
    setError(null);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captureKind === "mileage") {
      await submitMileage();
      return;
    }
    if (!file) {
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
    setError(null);
    setMessage(null);

    try {
      const submission = isPdfFile(file) && file.size > TARGET_UPLOAD_BYTES
        ? await uploadChunkedPdf(file)
        : await uploadStandardCapture(file);
      setSubmissions((current) => [submission, ...current]);
      setFile(null);
      setSelectedPropertyId("");
      setSelectedUnitId("");
      setPropertyLabel("");
      setUnitLabel("");
      setNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage(captureKind === "maintenance"
        ? "Maintenance report saved. Review it on the desktop to create or link a work order."
        : "Saved to your Mobile Inbox. It is ready on the desktop app.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Capture could not be saved.");
    } finally {
      setUploadProgress(null);
      setSaving(false);
    }
  }

  async function uploadStandardCapture(selectedFile: File): Promise<MobileSubmission> {
    const preparedFile = await prepareUploadFile(selectedFile);
    const form = new FormData();
    form.set("file", preparedFile);
    form.set("kind", captureKind);
    form.set("propertyLabel", propertyLabel);
    form.set("unitLabel", unitLabel);
    form.set("note", note);
    form.set("capturedAt", new Date().toISOString());
    const response = await fetch("/api/submissions", { method: "POST", body: form });
    const body = await readApiResponse<{ submission?: MobileSubmission } & ApiError>(response);
    if (!response.ok || !body.submission) throw new Error(body.error || "Capture could not be saved.");
    return body.submission;
  }

  async function uploadChunkedPdf(selectedFile: File): Promise<MobileSubmission> {
    if (captureKind !== "receipt") throw new Error("Large PDF upload is available for receipts and bills.");
    if (selectedFile.size > MAX_SELECTED_FILE_BYTES) throw new Error("Choose a PDF no larger than 15 MB.");
    setUploadProgress("Preparing PDF…");
    const sha256 = await sha256Hex(selectedFile);
    const chunkCount = Math.ceil(selectedFile.size / PDF_CHUNK_BYTES);
    const startResponse = await fetch("/api/submissions/chunked", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originalFileName: selectedFile.name,
        byteSize: selectedFile.size,
        chunkCount,
        sha256,
        propertyLabel,
        unitLabel,
        note,
        capturedAt: new Date().toISOString(),
      }),
    });
    const startBody = await readApiResponse<{ uploadId?: string; chunkBytes?: number } & ApiError>(startResponse);
    if (!startResponse.ok || !startBody.uploadId) throw new Error(startBody.error || "The PDF upload could not start.");
    const uploadId = startBody.uploadId;
    try {
      for (let partNumber = 0; partNumber < chunkCount; partNumber += 1) {
        setUploadProgress(`Uploading PDF ${partNumber + 1} of ${chunkCount}…`);
        const start = partNumber * PDF_CHUNK_BYTES;
        const response = await fetch(`/api/submissions/chunked/${encodeURIComponent(uploadId)}/${partNumber}`, {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: selectedFile.slice(start, Math.min(start + PDF_CHUNK_BYTES, selectedFile.size)),
        });
        const body = await readApiResponse<ApiError>(response);
        if (!response.ok) throw new Error(body.error || `PDF piece ${partNumber + 1} could not be saved.`);
      }
      setUploadProgress("Finishing PDF…");
      const completeResponse = await fetch(`/api/submissions/chunked/${encodeURIComponent(uploadId)}/complete`, { method: "POST" });
      const completeBody = await readApiResponse<{ submission?: MobileSubmission } & ApiError>(completeResponse);
      if (!completeResponse.ok || !completeBody.submission) throw new Error(completeBody.error || "The PDF could not be completed.");
      return completeBody.submission;
    } catch (error) {
      await fetch(`/api/submissions/chunked/${encodeURIComponent(uploadId)}`, { method: "DELETE" }).catch(() => undefined);
      throw error;
    }
  }

  async function submitMileage() {
    const miles = Number(businessMiles);
    if (!propertyLabel.trim()) {
      setError("Choose the property for this trip.");
      return;
    }
    if (!tripDate) {
      setError("Enter the trip date.");
      return;
    }
    if (!Number.isFinite(miles) || miles <= 0 || miles > 1000) {
      setError("Enter business miles between 0.1 and 1,000.");
      return;
    }
    if (!purpose.trim()) {
      setError("Add a short business purpose for this trip.");
      return;
    }
    setSaving(true);
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
      resetScopeFields();
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

  const pendingCount = submissions.filter((item) => item.status !== "imported").length + mileageEntries.filter((item) => item.status !== "imported").length;
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
        <p className="eyebrow">FIELD CAPTURE</p>
        <h1>Capture it now. Finish it at your desk.</h1>
        <p>Send receipts, maintenance photos, and business mileage to Rental Tracker while the details are still fresh.</p>
      </section>

      <section className="capture-card" aria-labelledby="capture-title">
        <div className="section-heading">
          <div>
            <p className="step-label">QUICK CAPTURE</p>
            <h2 id="capture-title">{captureKind === "maintenance" ? "Report maintenance" : captureKind === "mileage" ? "Log business mileage" : "Add a receipt"}</h2>
          </div>
          <span className="time-chip">About 15 sec</span>
        </div>

        <form onSubmit={submit}>
          <div className="capture-kind" role="group" aria-label="Capture type">
            <button
              type="button"
              className={captureKind === "receipt" ? "active" : ""}
              aria-pressed={captureKind === "receipt"}
              onClick={() => { setCaptureKind("receipt"); setError(null); setMessage(null); }}
            >
              <strong>Receipt</strong>
              <span>Expense or bill</span>
            </button>
            <button
              type="button"
              className={captureKind === "maintenance" ? "active" : ""}
              aria-pressed={captureKind === "maintenance"}
              onClick={() => { setCaptureKind("maintenance"); setError(null); setMessage(null); }}
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
              onClick={() => { setCaptureKind("mileage"); setError(null); setMessage(null); }}
            >
              <strong>Mileage</strong>
              <span>{usePropertyChoices ? "Business trip" : "Desktop sync needed"}</span>
            </button>
          </div>

          {captureKind !== "mileage" ? <label className={`file-drop ${file ? "has-file" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={chooseFile}
            />
            <span className="camera-glyph" aria-hidden="true">+</span>
            <strong>{file ? file.name : captureKind === "maintenance" ? "Take issue photo" : "Take photo or choose file"}</strong>
            <small>{file ? formatBytes(file.size) : captureKind === "maintenance" ? "JPEG or PNG · large photos optimized" : "JPEG or PNG · large photos optimized · PDFs up to 15 MB"}</small>
          </label> : (
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

          <label className="note-field">
            <span>{captureKind === "maintenance" ? "Issue details" : captureKind === "mileage" ? "Trip note" : "Note"} {captureKind === "maintenance" ? <em>required</em> : <em>optional</em>}</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={captureKind === "maintenance" ? "What is happening, where is it, and when did it start?" : captureKind === "mileage" ? "Parking, toll, or other detail to remember" : "What was this for?"}
              rows={2}
              maxLength={500}
            />
          </label>

          {error ? <p className="alert error" role="alert">{error}</p> : null}
          {message ? <p className="alert success" role="status">{message}</p> : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? uploadProgress || "Saving securely…" : captureKind === "maintenance" ? "Send maintenance report" : captureKind === "mileage" ? "Send mileage to desktop" : "Send to Mobile Inbox"}
          </button>
        </form>
      </section>

      <section className="queue-section" aria-labelledby="queue-title">
        <div className="section-heading queue-heading">
          <div>
            <p className="step-label">DESKTOP HANDOFF</p>
            <h2 id="queue-title">Mobile Inbox</h2>
          </div>
          <span className="count-badge">{pendingCount}</span>
        </div>

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
                  <strong>{item.submission.kind === "maintenance" ? "Maintenance report" : item.submission.originalFileName}</strong>
                  <span>{item.submission.propertyLabel || "Property not assigned"}{item.submission.unitLabel ? ` · ${item.submission.unitLabel}` : ""}</span>
                  <small>{relativeTime(item.submission.createdAt)} · {item.submission.status === "claimed" ? "Opened on desktop" : "Ready for desktop"}</small>
                </div>
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
                  <small>{item.mileageEntry.businessMiles} mi · {formatTripDate(item.mileageEntry.tripDate)} · {item.mileageEntry.status === "claimed" ? "Opened on desktop" : "Ready for desktop"}</small>
                </div>
                {item.mileageEntry.status === "pending" ? (
                  <button className="text-button" type="button" onClick={() => void removeMileageEntry(item.mileageEntry.id)}>Remove</button>
                ) : <span className="claimed-dot" title="Opened on desktop" />}
              </article>
            ))}
        </div>
      </section>

      <section className="coming-section" aria-label="Companion capabilities">
        <p className="step-label">NOW &amp; NEXT</p>
        <div className="coming-grid">
          <div><strong>Property choices</strong><span>{usePropertyChoices ? "Synced securely from your desktop" : "Manual entry works until your desktop syncs"}</span></div>
          <div><strong>Mileage log</strong><span>{usePropertyChoices ? "Ready for desktop-reviewed trip entries" : "Available after the updated desktop syncs"}</span></div>
        </div>
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
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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
