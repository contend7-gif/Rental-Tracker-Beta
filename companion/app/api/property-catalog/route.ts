import { getRequestUser } from "@/lib/auth";
import { listPropertyCatalog } from "@/lib/property-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!getRequestUser(request)) {
    return Response.json({ error: "Sign in is required." }, { status: 401 });
  }
  return Response.json(await listPropertyCatalog());
}
