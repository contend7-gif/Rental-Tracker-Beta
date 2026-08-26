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
