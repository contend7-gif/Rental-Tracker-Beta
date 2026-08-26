# Optional Mobile Companion Setup

Rental Tracker is a complete local-first desktop app without the Mobile Companion. Mobile capture is an optional integration for people who choose to operate a separate private Site.

Each user owns an independent deployment:

- their own private Site and Site access policy
- their own D1 metadata database and R2 file storage
- their own unique desktop sync secret
- their own private-Site access token
- their own encrypted pairing on each desktop computer

Cloning Rental Tracker does not grant access to an existing companion. The repository contains the integration code and an opaque deployment identifier, but no working sync secret or private-Site access token.

## Recommended setup with Codex and Sites

1. Clone or fork Rental Tracker and open the repository in Codex.
2. Remove the existing `project_id` value from `companion/.openai/hosting.json`. It identifies the maintainer's deployment and cannot be reused by another account. Keep the `d1` and `r2` binding names.
3. Ask Codex:

   > Create a new private ChatGPT Site from the `companion` folder for my account. Keep it owner-only, create separate D1 and R2 storage, generate a unique `COMPANION_SYNC_SECRET` as a protected runtime secret, deploy it, and help me pair Rental Tracker without exposing or committing any credentials.

4. Confirm the Site is owner-only before uploading personal documents.
5. In Rental Tracker, open **Settings > Admin & Tools > Mobile companion** and turn the feature on.
6. Pair the desktop using the new Site URL, the matching desktop sync secret, and that Site's private access token.
7. Use **Check connection** before sending real files.

Do not copy another person's Site URL or credentials. Do not commit runtime secrets, access tokens, rental records, uploaded files, or backups.

## Local validation

From the `companion` folder:

```text
npm install
npm test
npm run build
```

The desktop app can be used and released without building or deploying this folder.

## Integration rules for future development

Companion-powered improvements must follow these boundaries:

1. **Desktop remains authoritative.** Cloud captures do not become Rental Tracker records until the user reviews and imports them.
2. **The integration stays opt-in.** New installs default to off, and ordinary Documents workflows cannot depend on a companion connection.
3. **No maintainer-specific endpoint is a product default.** URLs and credentials belong to each user's local encrypted pairing.
4. **Failures degrade safely.** An unavailable companion may show a connection error, but it must not block manual uploads or local document work.
5. **Secrets never enter app settings or backups.** Store them only through OS-backed desktop secret storage and protected Site runtime secrets.
6. **Every deployment is isolated.** Do not place multiple unrelated Rental Tracker users into one shared inbox or storage namespace.
7. **Imported records retain provenance.** Preserve the companion submission ID, capture time, and file hash for duplicate prevention and auditability.
8. **Cloud retention is explicit.** A future retention policy should delete file bytes after successful import or after a user-selected period.

These rules allow the desktop app and companion to improve independently without turning the companion into a requirement.
