import { getRequestUser, ownerFingerprint } from "@/lib/auth";
import { listOwnerSubmissions } from "@/lib/submissions";
import { listOwnerMileageEntries, type MobileMileageEntry } from "@/lib/mileage";
import { recentImportConfirmations } from "@/lib/retention";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = getRequestUser(request);
  if (!user) return Response.json({ error: "Sign in is required." }, { status: 401 });
  const owner = await ownerFingerprint(user.email);
  await listOwnerSubmissions(owner);
  const [captures, mileage] = await Promise.all([recentImportConfirmations(owner), listOwnerMileageEntries(owner, true)]);
  const imported = [...captures, ...mileage.filter((entry: MobileMileageEntry) => entry.status === "imported").map((entry: MobileMileageEntry) => ({ id: entry.id, kind: "mileage", importedAt: entry.updatedAt, capturedAt: entry.capturedAt }))]
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 30);
  return Response.json({ imported }, { headers: { "Cache-Control": "no-store" } });
}
