import assert from "node:assert/strict";
import test from "node:test";
import { discardDraft, leaseDraftKey, readSavedDraft, saveDraft } from "./draftRecovery.ts";
function memoryStorage() {
  const entries = new Map<string, string>();
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); }, entries };
}
test("saved drafts survive a new reader, remain separate by record, and discard individually", () => {
  const storage = memoryStorage();
  saveDraft(storage, "transaction:new", { amount: "0", description: "Example unfinished record" });
  saveDraft(storage, "loan:example-id", { lender: "Example lender" });
  assert.equal(readSavedDraft(storage, "transaction:new")?.draft.amount, "0");
  assert.equal(readSavedDraft(storage, "transaction:another-id"), null);
  discardDraft(storage, "transaction:new");
  assert.equal(readSavedDraft(storage, "transaction:new"), null);
  assert.equal(readSavedDraft(storage, "loan:example-id")?.draft.lender, "Example lender");
});
test("drafts exclude nested file bytes, attachments, blobs, and unsafe object keys", () => {
  const storage = memoryStorage();
  const draft = JSON.parse('{"description":"Example","dataUrl":"private bytes","nested":{"attachment":{"dataUrl":"bytes"},"__proto__":{"polluted":true},"amount":0}}');
  draft.upload = new Blob(["private bytes"]);
  const saved = saveDraft(storage, "transaction:new", draft);
  assert.deepEqual(saved.draft, { description: "Example", nested: { amount: 0 } });
  assert.equal([...storage.entries.values()].join("").includes("private bytes"), false);
});
test("valid legacy window drafts migrate once without replacing newer saved work", () => {
  const storage = memoryStorage(); const legacy = memoryStorage();
  legacy.setItem("rental-tracker:draft:v1:loan:example", JSON.stringify({ draft: { lender: "Example legacy" }, savedAt: "2026-10-05T12:00:00Z" }));
  assert.equal(readSavedDraft(storage, "loan:example", legacy)?.draft.lender, "Example legacy");
  assert.equal(legacy.getItem("rental-tracker:draft:v1:loan:example"), null);
  legacy.setItem("rental-tracker:draft:v1:loan:example", JSON.stringify({ draft: { lender: "Outdated" }, savedAt: "2026-10-05T12:00:00Z" }));
  assert.equal(readSavedDraft(storage, "loan:example", legacy)?.draft.lender, "Example legacy");
  discardDraft(storage, "loan:example", legacy);
  assert.equal(readSavedDraft(storage, "loan:example", legacy), null);
});
test("malformed or unsupported saved drafts never restore or revive a legacy draft", () => {
  const storage = memoryStorage(); const legacy = memoryStorage();
  legacy.setItem("rental-tracker:draft:v1:transaction:new", JSON.stringify({ draft: { description: "Old" }, savedAt: "2026-10-05T12:00:00Z" }));
  for (const raw of ["{", "null", '{"draft":[],"savedAt":"2026-10-05"}', '{"draft":{},"savedAt":"invalid"}', '{"version":99,"draft":{},"savedAt":"2026-10-05"}', "x".repeat(100_151)]) {
    storage.setItem("rental-tracker:draft:v2:transaction:new", raw);
    assert.equal(readSavedDraft(storage, "transaction:new", legacy), null);
  }
});
test("storage failure and oversized saves preserve the earlier draft", () => {
  const storage = memoryStorage();
  saveDraft(storage, "transaction:new", { description: "Earlier" });
  assert.throws(() => saveDraft(storage, "transaction:new", { description: "x".repeat(100_001) }), /too large/);
  assert.equal(readSavedDraft(storage, "transaction:new")?.draft.description, "Earlier");
  const unavailable = { ...storage, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("unavailable"); } };
  assert.throws(() => saveDraft(unavailable, "transaction:new", { description: "New" }), /could not be saved/);
  assert.throws(() => discardDraft(unavailable, "transaction:new"), /could not be removed/);
  assert.equal(readSavedDraft(storage, "transaction:new")?.draft.description, "Earlier");
});
test("new lease drafts use stable property and unit keys while existing agreements retain record identity", () => {
  const first = { id: "first-generated-id", propertyId: "example-property", unit: "614" };
  const reopened = { ...first, id: "second-generated-id" };
  assert.equal(leaseDraftKey(first, false), leaseDraftKey(reopened, false));
  assert.notEqual(leaseDraftKey(first, false), leaseDraftKey({ ...first, unit: "616" }, false));
  assert.notEqual(leaseDraftKey(first, false), leaseDraftKey({ ...first, propertyId: "other-property" }, false));
  assert.equal(leaseDraftKey(first, true), "lease:first-generated-id");
});
