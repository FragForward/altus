import { execFileSync, spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

/**
 * Bridge to the external "Rechtschreibpruefung" spell checker (Claude via the
 * user's subscription). It is located through the native messaging host that
 * its installer registers for Chrome, so Altus needs no own configuration.
 */

const REGISTRY_KEY =
  "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\rechtschreibpruefung";

type HostMessage = { id: number; [key: string]: unknown };

let hostProcess: ChildProcess | null = null;
let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map<number, (answer: unknown) => void>();

/** Path of host.cmd from the registered native messaging manifest, or null. */
function findHostCommand(): string | null {
  if (process.platform !== "win32") return null;
  try {
    const output = execFileSync("reg", ["query", REGISTRY_KEY, "/ve"], {
      windowsHide: true,
    }).toString();
    const match = /REG_SZ\s+(.+)\s*$/m.exec(output);
    if (!match) return null;
    const manifest = JSON.parse(fs.readFileSync(match[1].trim(), "utf8"));
    return fs.existsSync(manifest.path) ? manifest.path : null;
  } catch {
    return null;
  }
}

/** The content script built for Chrome; read on every request so rebuilds apply on reload. */
export function getSpellcheckScript(): string | null {
  const hostCommand = findHostCommand();
  if (!hostCommand) return null;
  const script = path.join(path.dirname(hostCommand), "..", "dist", "chrome", "content.js");
  try {
    return fs.readFileSync(script, "utf8");
  } catch {
    return null;
  }
}

function startHost(): boolean {
  const hostCommand = findHostCommand();
  if (!hostCommand) return false;
  const child = spawn("cmd.exe", ["/d", "/c", hostCommand], { windowsHide: true });
  hostProcess = child;
  buffer = Buffer.alloc(0);
  child.stdout.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk] as unknown as Uint8Array[]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) break;
      const message = JSON.parse(buffer.subarray(4, 4 + length).toString("utf8")) as HostMessage;
      buffer = buffer.subarray(4 + length);
      const resolve = pending.get(message.id);
      if (resolve) {
        pending.delete(message.id);
        resolve(message);
      }
    }
  });
  child.on("exit", () => {
    if (hostProcess === child) hostProcess = null;
    for (const [id, resolve] of pending) resolve({ id, ok: false, fehler: "Hilfsprogramm beendet" });
    pending.clear();
  });
  child.on("error", () => {
    if (hostProcess === child) hostProcess = null;
  });
  return true;
}

/** Forwards a message from the WhatsApp webview to the host and returns its answer. */
export function sendToSpellcheckHost(message: Record<string, unknown>): Promise<unknown> {
  // The toolbar badge exists only in browsers; nothing to do in Altus.
  if (message.art === "status_tab") return Promise.resolve({ ok: true });
  if (!hostProcess && !startHost()) {
    return Promise.resolve({ ok: false, fehler: "Rechtschreibprüfung nicht installiert" });
  }
  return new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    const body = Buffer.from(JSON.stringify({ ...message, id }), "utf8");
    const header = Buffer.alloc(4);
    header.writeUInt32LE(body.length, 0);
    hostProcess?.stdin?.write(header);
    hostProcess?.stdin?.write(body);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ id, ok: false, fehler: "Zeitüberschreitung" });
      }
    }, 60000);
  });
}

export function stopSpellcheckHost() {
  hostProcess?.stdin?.end();
  hostProcess = null;
}
