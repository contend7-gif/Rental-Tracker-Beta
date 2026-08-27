import { requireDesktopAuthorization } from "@/lib/desktop-auth";
import { replacePropertyCatalog } from "@/lib/property-catalog";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const unauthorized = await requireDesktopAuthorization(request);
  if (unauthorized) return unauthorized;

  const bodyText = await request.text();
  if (new TextEncoder().encode(bodyText).byteLength > 256 * 1024) {
    return Response.json({ error: "Property catalog is too large." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return Response.json({ error: "Property catalog must be valid JSON." }, { status: 400 });
  }
  if (!isCatalogPayload(payload)) {
    return Response.json({ error: "Property catalog format is not supported." }, { status: 400 });
  }

  const catalog = await replacePropertyCatalog(payload);
  return Response.json({
    ok: true,
    propertyCount: catalog.properties.length,
    unitCount: catalog.properties.reduce((count, property) => count + property.units.length, 0),
    updatedAt: catalog.updatedAt,
  });
}

function isCatalogPayload(value: unknown): value is { version: 1; properties: unknown[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as { version?: unknown; properties?: unknown };
  return candidate.version === 1 && Array.isArray(candidate.properties);
}
