import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { listDesktopMileageEntries } from "@/lib/mileage";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  return Response.json({ mileageEntries: await listDesktopMileageEntries() });
}
