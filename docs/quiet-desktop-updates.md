# Quiet desktop updates

The app downloads updates in the background and displays progress at the bottom
of the sidebar. When ready, **Restart to update** saves the latest data, waits for
the save queue to finish, then requests a silent installation and relaunch.
The same action remains available in Settings. A failed save keeps the app open.
Restart is disabled until initial and deferred data have loaded, and while a
restart is already in progress.
Unsaved transaction forms use the existing draft prompt before restarting, so
you can keep editing, retain a draft, or explicitly discard the changes.

There is no update-ready popup. Closing the app normally does not install a
pending update; installation waits for the explicit restart action. The initial
setup wizard remains available for fresh installations. Windows can still ask
for elevation when an existing installation requires it.

## Installed upgrade verification

Before publishing, test two actual installer builds with an isolated Windows
user profile and sample rental data:

1. Install the older build containing this update flow, then make a newer build
   available through a test update feed.
2. Confirm the sidebar shows download progress and then Restart to update,
   without an update-ready popup. Check expanded and collapsed sidebar layouts.
3. Make a sample edit and immediately click Restart to update. Confirm no setup
   wizard appears, the app reopens at the new version, and the edit persists.
4. Repeat with a simulated save failure: the app must remain open and allow a
   retry after the failure is resolved.
5. Close normally with an update ready: no installer should start. Reopen and
   confirm the update becomes available again.

The packaged automated sidebar test simulates update status and intercepts the
save/install boundaries. It checks UI behavior, save ordering, save failure,
duplicate-click prevention, and recovery from an installer error; it does not
prove the real Windows installer completes silently or relaunches successfully.
Existing releases use their existing updater behavior once to receive this flow.
