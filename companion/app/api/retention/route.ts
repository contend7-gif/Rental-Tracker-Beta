import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import {
  clearImportedCloudFiles,
  getRetentionOverview,
  normalizeRetentionDays,
  RETENTION_DAY_OPTIONS,
  updateRetentionDays,
} from "@/lib/retention";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  return Response.json({ overview: await getRetentionOverview(await ownerFingerprint(user.email)) });
}

export async function PUT(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { retentionDays?: unknown } | null;
  const requested = Number(body?.retentionDays);
  if (!RETENTION_DAY_OPTIONS.includes(requested as 0 | 7 | 30)) {
    return Response.json({ error: "Choose immediate cleanup, 7 days, or 30 days." }, { status: 400 });
  }
  const result = await updateRetentionDays(
    await ownerFingerprint(user.email),
    normalizeRetentionDays(requested),
  );
  return Response.json({ overview: result, removedFiles: result.removedFiles, removedBytes: result.removedBytes });
}

export async function DELETE(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const result = await clearImportedCloudFiles(await ownerFingerprint(user.email));
  return Response.json({ overview: result, removedFiles: result.removedFiles, removedBytes: result.removedBytes });
}
