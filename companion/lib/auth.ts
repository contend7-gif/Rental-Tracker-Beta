export type CompanionUser = {
  email: string;
  displayName: string;
};

const EMAIL_HEADER = "oai-authenticated-user-email";
const NAME_HEADER = "oai-authenticated-user-full-name";
const NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";

export function getRequestUser(request: Request): CompanionUser | null {
  const email = request.headers.get(EMAIL_HEADER)?.trim();
  if (email) {
    const encodedName = request.headers.get(NAME_HEADER);
    const displayName =
      encodedName &&
      request.headers.get(NAME_ENCODING_HEADER) === "percent-encoded-utf-8"
        ? safeDecode(encodedName) ?? email
        : email;
    return { email, displayName };
  }

  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { email: "local-development@rental-tracker", displayName: "Local development" };
  }

  return null;
}

export async function ownerFingerprint(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
