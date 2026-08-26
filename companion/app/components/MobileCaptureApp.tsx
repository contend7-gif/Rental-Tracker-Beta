"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { MobileSubmission } from "@/lib/submissions";

type Props = {
  displayName: string;
  signOutPath: string | null;
};

type ApiError = { error?: string };

const MAX_SELECTED_FILE_BYTES = 15 * 1024 * 1024;
const TARGET_UPLOAD_BYTES = 700 * 1024;
const MAX_IMAGE_DIMENSION = 2400;

export function MobileCaptureApp({ displayName, signOutPath }: Props) {
  const [submissions, setSubmissions] = useState<MobileSubmission[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [propertyLabel, setPropertyLabel] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSubmissions = useCallback(async () => {
    try {
      const response = await fetch("/api/submissions", { cache: "no-store" });
      const body = (await response.json()) as { submissions?: MobileSubmission[] } & ApiError;
      if (!response.ok) throw new Error(body.error || "Could not load your captures.");
      setSubmissions(body.submissions ?? []);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your captures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadSubmissions(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSubmissions]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setMessage(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Take a receipt photo or choose a PDF first.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const preparedFile = await prepareUploadFile(file);
      const form = new FormData();
      form.set("file", preparedFile);
      form.set("propertyLabel", propertyLabel);
      form.set("unitLabel", unitLabel);
      form.set("note", note);
      form.set("capturedAt", new Date().toISOString());
      const response = await fetch("/api/submissions", { method: "POST", body: form });
      const body = await readApiResponse<{ submission?: MobileSubmission } & ApiError>(response);
      if (!response.ok || !body.submission) throw new Error(body.error || "Capture could not be saved.");
      setSubmissions((current) => [body.submission!, ...current]);
      setFile(null);
      setPropertyLabel("");
      setUnitLabel("");
      setNote("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setMessage("Saved to your Mobile Inbox. It is ready on the desktop app.");
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
        <h1>Receipt in. Paperwork done.</h1>
        <p>Snap it now. Finish the details from Rental Tracker when you are back at your desk.</p>
      </section>

      <section className="capture-card" aria-labelledby="capture-title">
        <div className="section-heading">
          <div>
            <p className="step-label">QUICK CAPTURE</p>
            <h2 id="capture-title">Add a receipt</h2>
          </div>
          <span className="time-chip">About 15 sec</span>
        </div>

        <form onSubmit={submit}>
          <label className={`file-drop ${file ? "has-file" : ""}`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              onChange={chooseFile}
            />
            <span className="camera-glyph" aria-hidden="true">+</span>
            <strong>{file ? file.name : "Take photo or choose file"}</strong>
            <small>{file ? formatBytes(file.size) : "JPEG or PNG · large photos optimized · PDFs up to 700 KB"}</small>
          </label>

          <div className="form-grid">
            <label>
              <span>Property <em>optional</em></span>
              <input
                value={propertyLabel}
                onChange={(event) => setPropertyLabel(event.target.value)}
                placeholder="e.g. Oak Street Duplex"
                maxLength={120}
              />
            </label>
            <label>
              <span>Unit <em>optional</em></span>
              <input
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
                placeholder="e.g. Unit 2"
                maxLength={80}
              />
            </label>
          </div>

          <label className="note-field">
            <span>Note <em>optional</em></span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What was this for?"
              rows={2}
              maxLength={500}
            />
          </label>

          {error ? <p className="alert error" role="alert">{error}</p> : null}
          {message ? <p className="alert success" role="status">{message}</p> : null}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving securely…" : "Send to Mobile Inbox"}
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
                {submission.contentType === "application/pdf" ? "PDF" : "IMG"}
              </div>
              <div className="queue-copy">
                <strong>{submission.originalFileName}</strong>
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

      <section className="coming-section" aria-label="Coming next">
        <p className="step-label">NEXT</p>
        <div className="coming-grid">
          <div><strong>Maintenance capture</strong><span>Photo + voice note to a work order</span></div>
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
