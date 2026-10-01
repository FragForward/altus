import { contextBridge, ipcRenderer, webFrame } from "electron";

const WORLD_ID = 1999;

/**
 * Runs the shared spell checker (same script as the Chrome extension) in its
 * own isolated world, so WhatsApp's page and CSP cannot interfere with it.
 */
export async function startSpellcheck() {
  const script: string | null = await ipcRenderer.invoke("spellcheck-script");
  if (!script) return;

  contextBridge.exposeInIsolatedWorld(WORLD_ID, "spellcheckBridge", {
    send: (message: Record<string, unknown>) =>
      ipcRenderer.invoke("spellcheck-message", message),
  });
  webFrame.setIsolatedWorldInfo(WORLD_ID, {
    name: "Rechtschreibpruefung",
    securityOrigin: window.location.origin,
    csp: "default-src 'self'; style-src 'self' 'unsafe-inline'",
  });

  // The script expects the extension messaging API; map it onto the bridge.
  const shim =
    "window.browser = { runtime: { sendMessage: (m) => spellcheckBridge.send(m), onMessage: { addListener() {} } } };\n";
  await webFrame.executeJavaScriptInIsolatedWorld(WORLD_ID, [{ code: shim + script }]);
}
