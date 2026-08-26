import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import {
  cleanOptionalText,
  createSubmission,
  listOwnerSubmissions,
  validateUpload,
} from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const submissions = await listOwnerSubmissions(await ownerFingerprint(user.email));
  return Response.json({ submissions });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const requestedKind = cleanOptionalText(form.get("kind"), 20);
  const kind = requestedKind === "maintenance" ? "maintenance" : "receipt";
  if (!(file instanceof File)) {
    return Response.json({ error: kind === "maintenance" ? "Take a photo of the maintenance issue." : "Choose a receipt photo or PDF." }, { status: 400 });
  }
  const validationError = validateUpload(file);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });

  const requestedCaptureTime = cleanOptionalText(form.get("capturedAt"), 40);
  const parsedCaptureTime = requestedCaptureTime ? Date.parse(requestedCaptureTime) : Number.NaN;
  const capturedAt = Number.isFinite(parsedCaptureTime)
    ? new Date(parsedCaptureTime).toISOString()
    : new Date().toISOString();
  const propertyLabel = cleanOptionalText(form.get("propertyLabel"), 120);
  const unitLabel = cleanOptionalText(form.get("unitLabel"), 80);
  const note = cleanOptionalText(form.get("note"), 500);
  if (kind === "maintenance" && !propertyLabel) {
    return Response.json({ error: "Choose or enter the property for this maintenance issue." }, { status: 400 });
  }
  if (kind === "maintenance" && !note) {
    return Response.json({ error: "Add a short description of the maintenance issue." }, { status: 400 });
  }

  const submission = await createSubmission({
    ownerFingerprint: await ownerFingerprint(user.email),
    kind,
    file,
    propertyLabel,
    unitLabel,
    note,
    capturedAt,
  });
  return Response.json({ submission }, { status: 201 });
}
