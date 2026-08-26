import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Rental Tracker mobile capture shell", async () => {
  const [layout, component] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MobileCaptureApp.tsx", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);
  assert.match(layout, /title: "Rental Tracker Companion"/);
  assert.match(component, /Capture it now\. Finish it at your desk\./);
  assert.match(component, /Send to Mobile Inbox/);
  assert.match(component, /Send maintenance report/);
  assert.match(component, /form\.set\("kind", captureKind\)/);
  assert.match(component, /prepareUploadFile/);
  assert.match(component, /payload too large/i);
  assert.match(component, /TARGET_UPLOAD_BYTES = 700 \* 1024/);
  assert.doesNotMatch(`${layout}\n${component}`, /Your site is taking shape|react-loading-skeleton/i);
});

test("declares private-storage boundaries and a mobile manifest", async () => {
  const [hosting, manifest, desktopRoute, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "UPLOADS");
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(desktopRoute, /requireDesktopAuthorization/);
  assert.match(worker, /UPLOADS: R2Bucket/);
});

test("maintenance reports use the existing private capture queue", async () => {
  const [route, submissions, schema] = await Promise.all([
    readFile(new URL("../app/api/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/submissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /requestedKind === "maintenance"/);
  assert.match(route, /property for this maintenance issue/);
  assert.match(route, /description of the maintenance issue/);
  assert.match(submissions, /"receipt" \| "maintenance"/);
  assert.match(submissions, /input\.kind === "maintenance" \? "maintenance" : "receipts"/);
  assert.match(schema, /\["receipt", "maintenance"\]/);
});
