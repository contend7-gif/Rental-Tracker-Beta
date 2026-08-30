const SECRET_KEYS = {
  siteUrl: "companion.siteUrl",
  syncSecret: "companion.syncSecret",
  sitesBypassToken: "companion.sitesBypassToken",
};
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;

export function createCompanionSyncService({ secretStore, fetchImpl = fetch } = {}) {
  if (!secretStore) throw new Error("Mobile companion secret storage is unavailable.");

  async function getConfig() {
    const [siteUrlResult, syncSecretResult, bypassResult] = await Promise.all([
      secretStore.getSecret(SECRET_KEYS.siteUrl),
      secretStore.getSecret(SECRET_KEYS.syncSecret),
      secretStore.getSecret(SECRET_KEYS.sitesBypassToken),
    ]);
    return {
      siteUrl: normalizeSiteUrl(siteUrlResult?.value),
      syncSecret: String(syncSecretResult?.value || "").trim(),
      sitesBypassToken: String(bypassResult?.value || "").trim(),
    };
  }

  async function request(pathname, options = {}) {
    const config = await getConfig();
    if (!config.siteUrl || !config.syncSecret) {
      throw new Error("Connect the Mobile Companion before refreshing its inbox.");
    }
    const headers = new Headers(options.headers || {});
    headers.set("authorization", `Bearer ${config.syncSecret}`);
    headers.set("accept", "application/json");
    if (config.sitesBypassToken) {
      headers.set("OAI-Sites-Authorization", `Bearer ${config.sitesBypassToken}`);
    }
    const response = await fetchImpl(new URL(pathname, `${config.siteUrl}/`), {
      ...options,
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(String(body?.error || `Mobile Companion returned ${response.status}.`));
    }
    return response;
  }

  return {
    async getStatus() {
      const config = await getConfig();
      return {
        ok: true,
        configured: Boolean(config.siteUrl && config.syncSecret),
        siteUrl: config.siteUrl,
        hasSyncSecret: Boolean(config.syncSecret),
        hasSitesBypassToken: Boolean(config.sitesBypassToken),
      };
    },

    async configure(payload) {
      const current = await getConfig();
      const siteUrl = normalizeSiteUrl(payload?.siteUrl);
      const syncSecret = String(payload?.syncSecret || "").trim() || current.syncSecret;
      const sitesBypassToken = String(payload?.sitesBypassToken || "").trim() || current.sitesBypassToken;
      if (!siteUrl) throw new Error("Enter the HTTPS address for the published Mobile Companion.");
      if (!syncSecret) throw new Error("Enter the desktop sync secret.");
      const results = await Promise.all([
        secretStore.setSecret(SECRET_KEYS.siteUrl, siteUrl),
        secretStore.setSecret(SECRET_KEYS.syncSecret, syncSecret),
        sitesBypassToken
          ? secretStore.setSecret(SECRET_KEYS.sitesBypassToken, sitesBypassToken)
          : secretStore.deleteSecret(SECRET_KEYS.sitesBypassToken),
      ]);
      const failure = results.find((result) => result?.ok === false);
      if (failure) throw new Error(failure.message || "Could not save Mobile Companion settings securely.");
      return { ok: true, configured: true, siteUrl };
    },

    async disconnect() {
      const results = await Promise.all(Object.values(SECRET_KEYS).map((key) => secretStore.deleteSecret(key)));
      const failure = results.find((result) => result?.ok === false);
      if (failure) throw new Error(failure.message || "Could not remove Mobile Companion settings securely.");
      return { ok: true, configured: false, siteUrl: "" };
    },

    async list() {
      const response = await request("api/desktop/submissions");
      const body = await response.json();
      return { ok: true, submissions: Array.isArray(body?.submissions) ? body.submissions : [] };
    },

    async syncPropertyCatalog(catalog) {
      const response = await request("api/desktop/property-catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(catalog || { version: 1, properties: [] }),
      });
      return { ok: true, ...(await response.json()) };
    },

    async listMileage() {
      const response = await request("api/desktop/mileage");
      const body = await response.json();
      return { ok: true, mileageEntries: Array.isArray(body?.mileageEntries) ? body.mileageEntries : [] };
    },

    async claimMileage(id) {
      const safeId = requireSubmissionId(id);
      const response = await request(`api/desktop/mileage/${safeId}/claim`, { method: "POST" });
      return { ok: true, ...(await response.json()) };
    },

    async completeMileage(id) {
      const safeId = requireSubmissionId(id);
      const response = await request(`api/desktop/mileage/${safeId}/complete`, { method: "POST" });
      return { ok: true, ...(await response.json()) };
    },

    async claim(id) {
      const safeId = requireSubmissionId(id);
      const response = await request(`api/desktop/submissions/${safeId}/claim`, { method: "POST" });
      return { ok: true, ...(await response.json()) };
    },

    async download(id) {
      const safeId = requireSubmissionId(id);
      const response = await request(`api/desktop/submissions/${safeId}/file`, {
        headers: { accept: "application/octet-stream" },
      });
      const length = Number(response.headers.get("content-length") || 0);
      if (length > MAX_DOWNLOAD_BYTES) throw new Error("The companion file exceeds the 15 MB desktop limit.");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("The companion file exceeds the 15 MB desktop limit.");
      const encodedSubmission = response.headers.get("x-rental-submission") || "";
      const submission = encodedSubmission ? JSON.parse(decodeURIComponent(encodedSubmission)) : null;
      const mimeType = String(response.headers.get("content-type") || submission?.contentType || "application/octet-stream").split(";")[0];
      return {
        ok: true,
        submission,
        dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      };
    },

    async remove(id) {
      const safeId = requireSubmissionId(id);
      await request(`api/desktop/submissions/${safeId}`, { method: "DELETE" });
      return { ok: true };
    },

    async complete(id) {
      const safeId = requireSubmissionId(id);
      const response = await request(`api/desktop/submissions/${safeId}/complete`, { method: "POST" });
      return { ok: true, ...(await response.json()) };
    },
  };
}

function normalizeSiteUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) return "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function requireSubmissionId(value) {
  const id = String(value || "").trim();
  if (!/^[a-f0-9-]{20,80}$/i.test(id)) throw new Error("Invalid Mobile Companion capture id.");
  return encodeURIComponent(id);
}
