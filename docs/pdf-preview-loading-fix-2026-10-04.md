# PDF preview loading and restart checks

The failing resource was `chrome://resources/css/text_defaults_md.css`, inside Chromium's built-in PDF viewer. Diagnostic runs also captured canceled native-viewer navigation when nested previews were closed. The saved document itself loaded, and the previous restart check only waited for iframe visibility before closing its full-screen and linked-transaction previews.

Both inline record previews and the full document preview now use one PDF component with a visible loading state, a load-event readiness signal, and a retry option for iframe loading errors. Native PDF viewing and external-file actions are retained.

The restart regression waits for that load event at each preview entry point before closing or navigating. Its renderer-error assertion remains unchanged; no error messages or resource URLs are filtered. Temporary diagnostic listeners were removed.

This is a local UI and regression fix. No stored documents, installed records, or release version changed.

Validation: 739 automated tests, types, production packaging, twelve consecutive PDF restart/nested-preview runs, all 32 packaged desktop workflows, and release smoke passed. A final visual run also passed with a brief paint allowance after the load event for screenshot capture.
