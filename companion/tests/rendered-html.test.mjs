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
  assert.match(component, /PDF_CHUNK_BYTES = 512 \* 1024/);
  assert.match(component, /PDFs up to 15 MB/);
  assert.match(component, /\/api\/submissions\/chunked/);
  assert.match(component, /\/api\/property-catalog/);
  assert.match(component, /Choose a property/);
  assert.match(component, /Enter manually/);
  assert.doesNotMatch(`${layout}\n${component}`, /Your site is taking shape|react-loading-skeleton/i);
});

test("large PDFs use private chunk storage and integrity verification", async () => {
  const [component, startRoute, partRoute, completeRoute, submissions, schema] = await Promise.all([
    readFile(new URL("../app/components/MobileCaptureApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/chunked/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/chunked/[id]/[part]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/submissions/chunked/[id]/complete/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/submissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /sha256Hex\(selectedFile\)/);
  assert.match(component, /Uploading PDF \$\{partNumber \+ 1\} of \$\{chunkCount\}/);
  assert.match(startRoute, /getRequestUser/);
  assert.match(partRoute, /ownerFingerprint/);
  assert.match(completeRoute, /completeChunkedUpload/);
  assert.match(submissions, /MAX_CHUNKED_PDF_BYTES = 15 \* 1024 \* 1024/);
  assert.match(submissions, /The completed PDF did not pass its integrity check/);
  assert.match(submissions, /UPLOADS\.delete\(keys\)/);
  assert.match(schema, /mobile_upload_sessions/);
});

test("declares private-storage boundaries and a mobile manifest", async () => {
  const [hosting, manifest, desktopRoute, desktopDeleteRoute, submissions, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/submissions/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/submissions.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "UPLOADS");
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(desktopRoute, /requireDesktopAuthorization/);
  assert.match(desktopDeleteRoute, /requireDesktopAuthorization/);
  assert.match(desktopDeleteRoute, /deleteDesktopSubmission/);
  assert.match(submissions, /status IN \('pending', 'claimed'\)/);
  assert.match(submissions, /UPLOADS\.delete\(stored\.storageKey\)/);
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

test("property choices use authenticated browser access and desktop-only replacement", async () => {
  const [browserRoute, desktopRoute, catalog, schema] = await Promise.all([
    readFile(new URL("../app/api/property-catalog/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/property-catalog/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/property-catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(browserRoute, /getRequestUser/);
  assert.match(desktopRoute, /requireDesktopAuthorization/);
  assert.match(desktopRoute, /replacePropertyCatalog/);
  assert.match(catalog, /property_id, label, address_label, units_json/);
  assert.match(schema, /companion_property_catalog/);
  assert.doesNotMatch(catalog, /tenant|lease|rent|finance|document/i);
});

test("mileage entries are private, structured, and require desktop review", async () => {
  const [component, browserRoute, desktopRoute, mileage, schema] = await Promise.all([
    readFile(new URL("../app/components/MobileCaptureApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/mileage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/mileage/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/mileage.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(component, /Log business mileage/);
  assert.match(component, /Review it on the desktop before it becomes an expense/);
  assert.match(browserRoute, /getRequestUser/);
  assert.match(desktopRoute, /requireDesktopAuthorization/);
  assert.match(mileage, /business_miles_tenths/);
  assert.match(mileage, /status IN \('pending', 'claimed'\)/);
  assert.match(schema, /mobile_mileage_entries/);
  assert.doesNotMatch(mileage, /gps|latitude|longitude/i);
});
