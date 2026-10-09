import { getChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import { MobileCaptureApp } from "./components/MobileCaptureApp";
import { ownerFingerprint } from "../lib/auth";

import { version } from "../package.json";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <MobileCaptureApp
      companionVersion={version}
      displayName={user?.displayName ?? "Local development"}
      draftOwner={await ownerFingerprint(user?.email ?? "local-development@rental-tracker")}
      signOutPath={user ? chatGPTSignOutPath("/") : null}
    />
  );
}
