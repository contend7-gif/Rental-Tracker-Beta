import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { listDesktopSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;
  return Response.json({ submissions: await listDesktopSubmissions() });
}
