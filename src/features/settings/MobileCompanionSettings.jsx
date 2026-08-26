import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

const SETTINGS_CARD_CLASS = "self-start rounded-lg border border-slate-200 bg-slate-50/60 p-3";

export function MobileCompanionSettings({ appSettings, desktopCompanionApi, setSetting }) {
  const enabled = appSettings.mobileCompanionEnabled === true;
  const [status, setStatus] = useState(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [syncSecret, setSyncSecret] = useState("");
  const [sitesBypassToken, setSitesBypassToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPairing, setShowPairing] = useState(false);
  const [disconnectArmed, setDisconnectArmed] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = useCallback(async () => {
    if (!desktopCompanionApi?.getStatus) {
      setStatus(null);
      return null;
    }
    try {
      const nextStatus = await desktopCompanionApi.getStatus();
      setStatus(nextStatus);
      setSiteUrl(nextStatus?.siteUrl || "");
      return nextStatus;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not read the companion connection status.");
      return null;
    }
  }, [desktopCompanionApi]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function saveConnection(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await desktopCompanionApi.configure({ siteUrl, syncSecret, sitesBypassToken });
      if (result?.ok === false) throw new Error(result.message || result.error || "Could not save the companion connection.");
      setSyncSecret("");
      setSitesBypassToken("");
      setShowPairing(false);
      await loadStatus();
      setMessage("Companion pairing saved securely on this computer.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the companion connection.");
    } finally {
      setBusy(false);
    }
  }

  async function checkConnection() {
    setBusy(true);
    setMessage("");
    try {
      const result = await desktopCompanionApi.list();
      if (result?.ok === false) throw new Error(result.message || result.error || "Could not reach the companion.");
      setMessage(`Connection verified. ${result?.submissions?.length || 0} capture${result?.submissions?.length === 1 ? " is" : "s are"} waiting.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reach the companion.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage("");
    try {
      const result = await desktopCompanionApi.disconnect();
      if (result?.ok === false) throw new Error(result.message || result.error || "Could not disconnect the companion.");
      setDisconnectArmed(false);
      setShowPairing(false);
      setSyncSecret("");
      setSitesBypassToken("");
      await loadStatus();
      setMessage("This computer is disconnected. The private Site and its stored captures were not deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disconnect the companion.");
    } finally {
      setBusy(false);
    }
  }

  const configured = Boolean(status?.configured);

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className={SETTINGS_CARD_CLASS}>
        <Label>Mobile companion</Label>
        <Select value={enabled ? "on" : "off"} onValueChange={(value) => setSetting("mobileCompanionEnabled", value === "on")}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="off">Off and hidden</SelectItem>
            <SelectItem value="on">On</SelectItem>
          </SelectContent>
        </Select>
        <div className="mt-2 text-xs text-slate-500">
          Off hides Mobile Inbox from Documents. It does not remove saved credentials or change your private Site.
        </div>
      </div>

      <div className={`${SETTINGS_CARD_CLASS} md:col-span-1 xl:col-span-2`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Label>Connection on this computer</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{desktopCompanionApi ? "Desktop bridge ready" : "Installed app required"}</Badge>
              <Badge variant="secondary" className={configured ? "!bg-emerald-100 !text-emerald-700" : ""}>
                {configured ? "Paired securely" : "Not paired"}
              </Badge>
              {status?.hasSitesBypassToken ? <Badge variant="secondary">Private-site token saved</Badge> : null}
            </div>
          </div>
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {configured ? <CheckCircle2 className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
          </span>
        </div>
        {configured ? <div className="mt-2 break-all text-xs text-slate-500">{status.siteUrl}</div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {configured ? (
            <Button size="sm" variant="secondary" onClick={() => void checkConnection()} disabled={busy || !enabled}>
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              Check connection
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={() => setShowPairing((value) => !value)} disabled={!desktopCompanionApi || !enabled}>
            {configured ? "Update pairing" : "Pair this computer"}
          </Button>
          {configured && !disconnectArmed ? (
            <Button size="sm" variant="ghost" onClick={() => setDisconnectArmed(true)} disabled={busy}>Disconnect</Button>
          ) : null}
        </div>
        {disconnectArmed ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
            <div>Remove the companion address and both encrypted credentials from this computer?</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="destructive" onClick={() => void disconnect()} disabled={busy}>Remove saved credentials</Button>
              <Button size="sm" variant="ghost" onClick={() => setDisconnectArmed(false)} disabled={busy}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className={SETTINGS_CARD_CLASS}>
        <Label>Separate, user-owned service</Label>
        <div className="mt-2 text-xs leading-5 text-slate-500">
          Rental Tracker works fully without the companion. Each user who wants mobile capture must deploy and privately own a separate companion Site, storage, and credentials.
        </div>
        <details className="mt-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-800">How another user sets it up</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>Create a private Site from the included companion source.</li>
            <li>Create a unique desktop sync secret for that Site.</li>
            <li>Generate that Site's private access token.</li>
            <li>Enable this setting and pair the desktop with those three values.</li>
          </ol>
          <a className="mt-2 inline-flex items-center font-medium text-teal-700 hover:text-teal-800" href="https://github.com/contend7-gif/Rental-Tracker-Beta/blob/main/docs/mobile-companion-setup.md" target="_blank" rel="noreferrer">
            Full setup guide <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </details>
      </div>

      {showPairing ? (
        <form className="rounded-lg border border-teal-200 bg-teal-50/50 p-3 md:col-span-2 xl:col-span-4" onSubmit={saveConnection}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-xs font-medium text-slate-700">Published companion address</span>
              <Input className="mt-1" type="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="https://your-companion.example" required />
            </label>
            <label>
              <span className="text-xs font-medium text-slate-700">Desktop sync secret</span>
              <Input className="mt-1" type="password" value={syncSecret} onChange={(event) => setSyncSecret(event.target.value)} placeholder={status?.hasSyncSecret ? "Leave blank to keep saved secret" : "Required"} required={!status?.hasSyncSecret} />
            </label>
            <label>
              <span className="text-xs font-medium text-slate-700">Private-site access token</span>
              <Input className="mt-1" type="password" value={sitesBypassToken} onChange={(event) => setSitesBypassToken(event.target.value)} placeholder={status?.hasSitesBypassToken ? "Leave blank to keep saved token" : "Required for a private Site"} required={!status?.hasSitesBypassToken} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Credentials are encrypted by Windows and excluded from Rental Tracker backups.</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" type="button" onClick={() => setShowPairing(false)}>Cancel</Button>
              <Button size="sm" type="submit" disabled={busy}>{busy ? "Saving…" : "Save pairing"}</Button>
            </div>
          </div>
        </form>
      ) : null}

      {message ? <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 md:col-span-2 xl:col-span-4">{message}</div> : null}
    </div>
  );
}
