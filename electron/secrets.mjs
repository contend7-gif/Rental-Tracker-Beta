import { safeStorage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

const SECRET_KEY_PATTERN = /^[a-zA-Z0-9_.:-]{1,80}$/;

export function isValidSecretKey(key) {
  return SECRET_KEY_PATTERN.test(String(key || ""));
}

function secretFilePath(secretsDir, key) {
  if (!isValidSecretKey(key)) {
    throw new Error("Invalid secret key.");
  }
  return path.join(secretsDir, `${String(key).replace(/[^a-zA-Z0-9_.:-]/g, "_")}.secret`);
}

export function createSecretStore({ secretsDir, storage = safeStorage }) {
  const encryptionAvailable = Boolean(storage?.isEncryptionAvailable?.());
  const backend = typeof storage?.getSelectedStorageBackend === "function"
    ? String(storage.getSelectedStorageBackend() || "")
    : "";

  return {
    isEncryptionAvailable() {
      return encryptionAvailable;
    },
    getBackend() {
      return backend || (encryptionAvailable ? "safeStorage" : "unavailable");
    },
    async getSecret(key) {
      if (!isValidSecretKey(key) || !encryptionAvailable) return { ok: false, value: "", hasValue: false };
      try {
        const encrypted = await fs.readFile(secretFilePath(secretsDir, key));
        const value = storage.decryptString(encrypted);
        return { ok: true, value, hasValue: Boolean(value) };
      } catch {
        return { ok: true, value: "", hasValue: false };
      }
    },
    async setSecret(key, value) {
      if (!isValidSecretKey(key)) return { ok: false, message: "Invalid secret key." };
      if (!encryptionAvailable) return { ok: false, message: "OS-backed encryption is unavailable on this device." };
      await fs.mkdir(secretsDir, { recursive: true });
      const normalized = String(value || "");
      if (!normalized) {
        await fs.unlink(secretFilePath(secretsDir, key)).catch(() => undefined);
        return { ok: true, hasValue: false };
      }
      const encrypted = storage.encryptString(normalized);
      await fs.writeFile(secretFilePath(secretsDir, key), encrypted);
      return { ok: true, hasValue: true };
    },
    async deleteSecret(key) {
      if (!isValidSecretKey(key)) return { ok: false, message: "Invalid secret key." };
      await fs.unlink(secretFilePath(secretsDir, key)).catch(() => undefined);
      return { ok: true, hasValue: false };
    },
  };
}

export function sanitizeSettingsForSecretExport(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  const { aiOpenAiApiKey: _secret, ...rest } = source;
  return rest;
}
