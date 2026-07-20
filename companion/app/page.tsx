import { getChatGPTUser, chatGPTSignOutPath } from "./chatgpt-auth";
import { MobileCaptureApp } from "./components/MobileCaptureApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <MobileCaptureApp
      displayName={user?.displayName ?? "Local development"}
      signOutPath={user ? chatGPTSignOutPath("/") : null}
    />
  );
}
