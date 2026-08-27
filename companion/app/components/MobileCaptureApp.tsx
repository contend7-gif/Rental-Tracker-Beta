"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { PropertyCatalogItem } from "@/lib/property-catalog";
import type { MobileSubmission } from "@/lib/submissions";

type Props = {
  displayName: string;
  signOutPath: string | null;
};

type ApiError = { error?: string };
type CaptureKind = "receipt" | "maintenance";

const MAX_SELECTED_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 700 * 1024;
const MAX_IMAGE_DIMENSION = 2400;
const MANUAL_CHOICE = "__manual__";

export function MobileCaptureApp({ displayName, signOutPath }: Props) {
  const [submissions, setSubmissions] = useState<MobileSubmission[]>([]);
  const [propertyCatalog, setPropertyCatalog] = useState<PropertyCatalogItem[]>([]);
  const [captureKind, setCaptureKind] = useState<CaptureKind>("receipt");
  const [file, setFile] = useState<File | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [propertyLabel, setPropertyLabel] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [submissionsResponse, catalogResponse] = await Promise.all([
        fetch("/api/submissions", { cache: "no-store" }),
        fetch("/api/property-catalog", { cache: "no-store" }),
      ]);
      const submissionsBody = (await submissionsResponse.json()) as { submissions?: MobileSubmission[] } & ApiError;
      if (!submissionsResponse.ok) throw new Error(submissionsBody.error || "Could not load your captures.");
      setSubmissions(submissionsBody.submissions ?? []);

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
      const preparedFile = await prepareUploadFile(file);
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
      setSubmissions((current) => [body.submission!, ...current]);
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
      setSaving(false);
    }
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

  const pendingCount = submissions.filter((item) => item.status !== "imported").length;
  const selectedProperty = propertyCatalog.find((property) => property.id === selectedPropertyId) ?? null;
  const usePropertyChoices = propertyCatalog.length > 0;
  const useUnitChoices = Boolean(selectedProperty?.units.length);

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
        <p>Send receipts and maintenance photos to Rental Tracker while the details are still fresh.</p>
      </section>

      <section className="capture-card" aria-labelledby="capture-title">
        <div className="section-heading">
          <div>
            <p className="step-label">QUICK CAPTURE</p>
            <h2 id="capture-title">{captureKind === "maintenance" ? "Report maintenance" : "Add a receipt"}</h2>
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
          </div>

          <label className={`file-drop ${file ? "has-file" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={chooseFile}
            />
            <span className="camera-glyph" aria-hidden="true">+</span>
            <strong>{file ? file.name : captureKind === "maintenance" ? "Take issue photo" : "Take photo or choose file"}</strong>
            <small>{file ? formatBytes(file.size) : captureKind === "maintenance" ? "JPEG or PNG · large photos optimized" : "JPEG or PNG · large photos optimized · PDFs up to 700 KB"}</small>
          </label>

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
            <span>{captureKind === "maintenance" ? "Issue details" : "Note"} {captureKind === "receipt" ? <em>optional</em> : <em>required</em>}</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={captureKind === "maintenance" ? "What is happening, where is it, and when did it start?" : "What was this for?"}
              rows={2}
              maxLength={500}
            />
          </label>

          {error ? <p className="alert error" role="alert">{error}</p> : null}
          {message ? <p className="alert success" role="status">{message}</p> : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving securely…" : captureKind === "maintenance" ? "Send maintenance report" : "Send to Mobile Inbox"}
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
        {!loading && submissions.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing waiting</strong>
            <span>Your next capture will appear here and in the desktop app.</span>
          </div>
        ) : null}
        <div className="queue-list">
          {submissions.map((submission) => (
            <article className="queue-item" key={submission.id}>
              <div className="file-kind" aria-hidden="true">
                {submission.kind === "maintenance" ? "FIX" : submission.contentType === "application/pdf" ? "PDF" : "IMG"}
              </div>
              <div className="queue-copy">
                <strong>{submission.kind === "maintenance" ? "Maintenance report" : submission.originalFileName}</strong>
                <span>{submission.propertyLabel || "Property not assigned"}{submission.unitLabel ? ` · ${submission.unitLabel}` : ""}</span>
                <small>{relativeTime(submission.createdAt)} · {submission.status === "claimed" ? "Opened on desktop" : "Ready for desktop"}</small>
              </div>
              {submission.status === "pending" ? (
                <button className="text-button" type="button" onClick={() => void removeSubmission(submission.id)}>
                  Remove
                </button>
              ) : (
                <span className="claimed-dot" title="Opened on desktop" />
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="coming-section" aria-label="Companion capabilities">
        <p className="step-label">NOW &amp; NEXT</p>
        <div className="coming-grid">
          <div><strong>Property choices</strong><span>{usePropertyChoices ? "Synced securely from your desktop" : "Manual entry works until your desktop syncs"}</span></div>
          <div><strong>Mileage log</strong><span>Fast trip entry while it is fresh</span></div>
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
    throw new Error("Choose a photo or PDF smaller than 15 MB.");
  }
  if (file.size <= TARGET_UPLOAD_BYTES) return file;
  if (file.type === "application/pdf") {
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
