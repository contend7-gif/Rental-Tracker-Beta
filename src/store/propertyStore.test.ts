import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProperty } from "./propertyStore.ts";

test("normalizeProperty keeps image data and assigns one cover photo", () => {
  const property = normalizeProperty({
    id: "p1",
    name: "Duplex",
    address: "100 Main",
    type: "Duplex",
    photos: [
      { id: "photo-1", name: "Front.jpg", dataUrl: "data:image/jpeg;base64,abc", uploadedAt: "2026-06-11T00:00:00.000Z" },
      { id: "photo-2", name: "Rear.jpg", dataUrl: "data:image/jpeg;base64,def", uploadedAt: "2026-06-11T00:00:00.000Z", isCover: true },
    ],
  });

  assert.equal(property.photos?.length, 2);
  assert.equal(property.photos?.filter((photo) => photo.isCover).length, 1);
  assert.equal(property.photos?.find((photo) => photo.isCover)?.id, "photo-2");
});

test("normalizeProperty preserves archive state and photo organization metadata", () => {
  const property = normalizeProperty({
    id: "p1",
    name: "Duplex",
    address: "100 Main",
    type: "Duplex",
    archivedAt: "2026-06-12T12:00:00.000Z",
    photos: [{
      id: "photo-1",
      name: "Kitchen.jpg",
      dataUrl: "data:image/jpeg;base64,abc",
      uploadedAt: "2026-06-11T00:00:00.000Z",
      caption: "Updated kitchen",
      category: "Interior",
      capturedOn: "2026-06-10",
      unit: "A",
    }],
  });

  assert.equal(property.archivedAt, "2026-06-12T12:00:00.000Z");
  assert.equal(property.photos?.[0].caption, "Updated kitchen");
  assert.equal(property.photos?.[0].category, "Interior");
  assert.equal(property.photos?.[0].capturedOn, "2026-06-10");
  assert.equal(property.photos?.[0].unit, "A");
});

test("normalizeProperty drops non-image property photo payloads", () => {
  const property = normalizeProperty({
    id: "p1",
    name: "Duplex",
    address: "100 Main",
    type: "Duplex",
    photos: [
      { id: "bad", name: "Not an image", dataUrl: "data:text/plain;base64,abc", uploadedAt: "2026-06-11T00:00:00.000Z" },
    ],
  });

  assert.deepEqual(property.photos, []);
});
