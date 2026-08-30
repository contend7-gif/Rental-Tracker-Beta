import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { completeMileageEntry } from "@/lib/mileage";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const mileageEntry = await completeMileageEntry(id);
  if (!mileageEntry) return Response.json({ error: "Mileage entry was not found." }, { status: 404 });
  return Response.json({ mileageEntry });
}
