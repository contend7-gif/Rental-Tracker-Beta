import assert from "node:assert/strict";
import test from "node:test";

import { copyTextToClipboard } from "./appSupport.ts";

test("copyTextToClipboard falls back when navigator clipboard permission is denied", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const calls: string[] = [];
  const textarea = {
    setAttribute() {},
    style: {},
    focus() {},
    select() {},
    value: "",
  };

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body: {
        appendChild: () => calls.push("append"),
        removeChild: () => calls.push("remove"),
      },
      createElement: () => textarea,
      execCommand: (command: string) => {
        calls.push(command);
        return true;
      },
    },
  });

  try {
    assert.equal(await copyTextToClipboard("Planning memo"), true);
    assert.deepEqual(calls, ["append", "copy", "remove"]);
    assert.equal(textarea.value, "Planning memo");
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      // @ts-expect-error test cleanup
      delete globalThis.navigator;
    }
    if (originalDocument) {
      Object.defineProperty(globalThis, "document", originalDocument);
    } else {
      // @ts-expect-error test cleanup
      delete globalThis.document;
    }
  }
});
