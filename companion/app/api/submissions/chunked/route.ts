import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import {
  cleanOptionalText,
  createChunkedUploadSession,
  MAX_CHUNKED_PDF_BYTES,
  PDF_CHUNK_BYTES,
} from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > 32 * 1024) {
    return Response.json({ error: "PDF upload details are too large." }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "PDF upload details must be valid JSON." }, { status: 400 });
  }

  const originalFileName = cleanOptionalText(typeof payload.originalFileName === "string" ? payload.originalFileName : null, 120);
  const byteSize = Number(payload.byteSize);
  const chunkCount = Number(payload.chunkCount);
  const sha256 = cleanOptionalText(typeof payload.sha256 === "string" ? payload.sha256 : null, 64);
  if (!originalFileName || !/\.pdf$/i.test(originalFileName)) {
    return Response.json({ error: "Choose a PDF file." }, { status: 400 });
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_CHUNKED_PDF_BYTES) {
    return Response.json({ error: "Choose a PDF no larger than 15 MB." }, { status: 400 });
  }
  if (!Number.isInteger(chunkCount) || chunkCount !== Math.ceil(byteSize / PDF_CHUNK_BYTES)) {
    return Response.json({ error: "The PDF upload plan is invalid." }, { status: 400 });
  }
  if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256)) {
    return Response.json({ error: "The PDF fingerprint is invalid." }, { status: 400 });
  }

  const requestedCaptureTime = cleanOptionalText(typeof payload.capturedAt === "string" ? payload.capturedAt : null, 40);
  const parsedCaptureTime = requestedCaptureTime ? Date.parse(requestedCaptureTime) : Number.NaN;
  const result = await createChunkedUploadSession({
    ownerFingerprint: await ownerFingerprint(user.email),
    kind: "receipt",
    propertyLabel: cleanOptionalText(typeof payload.propertyLabel === "string" ? payload.propertyLabel : null, 120),
    unitLabel: cleanOptionalText(typeof payload.unitLabel === "string" ? payload.unitLabel : null, 80),
    note: cleanOptionalText(typeof payload.note === "string" ? payload.note : null, 500),
    originalFileName,
    byteSize,
    chunkCount,
    sha256,
    capturedAt: Number.isFinite(parsedCaptureTime) ? new Date(parsedCaptureTime).toISOString() : new Date().toISOString(),
  });
  return Response.json(result, { status: 201 });
}
