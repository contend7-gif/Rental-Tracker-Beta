import assert from "node:assert/strict";
import test from "node:test";
import { ACCESS_ROLE_LABELS, SETTING_CAPABILITY_BY_KEY, accessRoleHasCapability } from "./accessControl.ts";

test("access roles retain their expected permission boundaries", () => {
  assert.equal(accessRoleHasCapability("admin", "manage_data_admin"), true);
  assert.equal(accessRoleHasCapability("manager", "manage_data_admin"), false);
  assert.equal(accessRoleHasCapability("bookkeeper", "reconcile_records"), true);
  assert.equal(accessRoleHasCapability("read_only", "create_edit_records"), false);
  assert.equal(accessRoleHasCapability("read_only", "export_reports"), true);
});

test("access labels and sensitive settings remain mapped", () => {
  assert.equal(ACCESS_ROLE_LABELS.admin, "Admin");
  assert.equal(SETTING_CAPABILITY_BY_KEY.accessRole, "manage_access_profile");
  assert.equal(SETTING_CAPABILITY_BY_KEY.deMinimisHasAFS, "manage_financial_settings");
  assert.equal(SETTING_CAPABILITY_BY_KEY.aiOpenAiApiKey, "manage_personal_settings");
});
