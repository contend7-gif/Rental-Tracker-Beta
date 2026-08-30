import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { createMileageEntry, listOwnerMileageEntries, validateMileageInput } from "@/lib/mileage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json({ mileageEntries: await listOwnerMileageEntries(await ownerFingerprint(user.email)) });
}

export async function POST(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > 32 * 1024) {
    return Response.json({ error: "Mileage entry is too large." }, { status: 413 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return Response.json({ error: "Mileage entry must be valid JSON." }, { status: 400 });
  }
  const validation = validateMileageInput(payload);
  if (!validation.input) return Response.json({ error: validation.error }, { status: 400 });
  const mileageEntry = await createMileageEntry(await ownerFingerprint(user.email), validation.input);
  return Response.json({ mileageEntry }, { status: 201 });
}
