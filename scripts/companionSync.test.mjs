import assert from "node:assert/strict";
import test from "node:test";
import { createCompanionSyncService } from "../electron/companionSyncService.mjs";

function createMemorySecretStore(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getSecret(key) {
      const value = values.get(key) || "";
      return { ok: true, value, hasValue: Boolean(value) };
    },
    async setSecret(key, value) {
      values.set(key, value);
      return { ok: true, hasValue: true };
    },
    async deleteSecret(key) {
      values.delete(key);
      return { ok: true, hasValue: false };
    },
  };
}

test("companion pairing stays local and supplies both authorization layers", async () => {
  const secretStore = createMemorySecretStore();
  let request = null;
  const service = createCompanionSyncService({
    secretStore,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(JSON.stringify({ submissions: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.equal((await service.getStatus()).configured, false);
  await service.configure({
    siteUrl: "https://companion.example.test/",
    syncSecret: "desktop-key-example",
    sitesBypassToken: "private-site-key-example",
  });

  const status = await service.getStatus();
  assert.equal(status.configured, true);
  assert.equal(status.hasSyncSecret, true);
  assert.equal(status.hasSitesBypassToken, true);

  await service.list();
  assert.equal(request.url, "https://companion.example.test/api/desktop/submissions");
  assert.equal(request.options.headers.get("authorization"), "Bearer desktop-key-example");
  assert.equal(request.options.headers.get("OAI-Sites-Authorization"), "Bearer private-site-key-example");
});

test("disconnect removes every locally saved companion value", async () => {
  const secretStore = createMemorySecretStore({
    "companion.siteUrl": "https://companion.example.test",
    "companion.syncSecret": "desktop-key-example",
    "companion.sitesBypassToken": "private-site-key-example",
  });
  const service = createCompanionSyncService({ secretStore });

  const result = await service.disconnect();

  assert.deepEqual(result, { ok: true, configured: false, siteUrl: "" });
  assert.deepEqual([...secretStore.values.keys()], []);
  assert.equal((await service.getStatus()).configured, false);
});

test("desktop sends the privacy-limited property catalog as authenticated JSON", async () => {
  const secretStore = createMemorySecretStore({
    "companion.siteUrl": "https://companion.example.test",
    "companion.syncSecret": "desktop-key-example",
  });
  let request = null;
  const service = createCompanionSyncService({
    secretStore,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return Response.json({ ok: true, propertyCount: 1, unitCount: 1, updatedAt: "2026-08-26T00:00:00.000Z" });
    },
  });
  const catalog = {
    version: 1,
    properties: [{
      id: "property-1",
      label: "Oak Street Duplex",
      addressLabel: "123 Oak St",
      units: [{ id: "unit-1", label: "Unit 1" }],
    }],
  };

  const result = await service.syncPropertyCatalog(catalog);

  assert.equal(request.url, "https://companion.example.test/api/desktop/property-catalog");
  assert.equal(request.options.method, "PUT");
  assert.equal(request.options.headers.get("authorization"), "Bearer desktop-key-example");
  assert.equal(request.options.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(request.options.body), catalog);
  assert.equal(result.propertyCount, 1);
  assert.equal(result.unitCount, 1);
});

test("desktop mileage requests use the existing authenticated companion connection", async () => {
  const secretStore = createMemorySecretStore({
    "companion.siteUrl": "https://companion.example.test",
    "companion.syncSecret": "desktop-key-example",
  });
  const requests = [];
  const service = createCompanionSyncService({
    secretStore,
    fetchImpl: async (url, options) => {
      requests.push({ url: String(url), method: options?.method || "GET", authorization: options?.headers?.get("authorization") });
      return Response.json(String(url).endsWith("/api/desktop/mileage")
        ? { mileageEntries: [{ id: "a1b2c3d4-e5f6-7890-abcd-123456789012" }] }
        : { mileageEntry: { id: "a1b2c3d4-e5f6-7890-abcd-123456789012" } });
    },
  });

  const listed = await service.listMileage();
  await service.claimMileage("a1b2c3d4-e5f6-7890-abcd-123456789012");
  await service.completeMileage("a1b2c3d4-e5f6-7890-abcd-123456789012");

  assert.equal(listed.mileageEntries.length, 1);
  assert.deepEqual(requests.map(({ url, method }) => ({ url, method })), [
    { url: "https://companion.example.test/api/desktop/mileage", method: "GET" },
    { url: "https://companion.example.test/api/desktop/mileage/a1b2c3d4-e5f6-7890-abcd-123456789012/claim", method: "POST" },
    { url: "https://companion.example.test/api/desktop/mileage/a1b2c3d4-e5f6-7890-abcd-123456789012/complete", method: "POST" },
  ]);
  assert.ok(requests.every((request) => request.authorization === "Bearer desktop-key-example"));
});

test("desktop can permanently remove an unimported mobile capture", async () => {
  const secretStore = createMemorySecretStore({
    "companion.siteUrl": "https://companion.example.test",
    "companion.syncSecret": "desktop-key-example",
  });
  let request = null;
  const service = createCompanionSyncService({
    secretStore,
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(null, { status: 204 });
    },
  });

  const result = await service.remove("a1b2c3d4-e5f6-7890-abcd-123456789012");

  assert.deepEqual(result, { ok: true });
  assert.equal(request.url, "https://companion.example.test/api/desktop/submissions/a1b2c3d4-e5f6-7890-abcd-123456789012");
  assert.equal(request.options.method, "DELETE");
  assert.equal(request.options.headers.get("authorization"), "Bearer desktop-key-example");
});
