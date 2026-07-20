import { env } from "cloudflare:workers";

const LOCAL_SECRET = "local-rental-tracker-sync";

export async function requireDesktopAuthorization(request: Request): Promise<Response | null> {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const configured = getConfiguredSecret(request);

  if (!supplied || !(await safeEqual(supplied, configured))) {
    return Response.json({ error: "Desktop authorization failed." }, { status: 401 });
  }
  return null;
}

function getConfiguredSecret(request: Request): string {
  const configured = (env as unknown as { COMPANION_SYNC_SECRET?: string })
    .COMPANION_SYNC_SECRET?.trim();
  if (configured) return configured;

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return LOCAL_SECRET;
  return "disabled-no-secret-configured";
}

async function safeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < Math.max(leftBytes.length, rightBytes.length); index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return mismatch === 0;
}
