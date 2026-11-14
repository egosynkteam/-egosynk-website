// Renders a share-preview template (scripts/og-<name>.html) to public/img/og-<name>.jpg at
// 1200x630, the size WhatsApp, Instagram, X and Facebook use.
//   node scripts/render-og.mjs bold
// Needs Chrome or Edge installed; set BROWSER to its path if it isn't found.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const name = process.argv[2];
if (!name) { console.error("Usage: node scripts/render-og.mjs <name>   (renders scripts/og-<name>.html)"); process.exit(1); }
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, `og-${name}.html`);
const out = path.join(here, "..", "public", "img", `og-${name}.jpg`);
if (!existsSync(src)) { console.error(`No template at ${src}`); process.exit(1); }

const CANDIDATES = [process.env.BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
const browser = CANDIDATES.find((p) => existsSync(p));
if (!browser) { console.error("Chrome or Edge not found; set BROWSER=/path/to/browser"); process.exit(1); }

const W = 1200, H = 630, PORT = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(path.join(tmpdir(), "og-"));
const proc = spawn(browser, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try { const page = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); if (page) ws = new WebSocket(page.webSocketDebuggerUrl); } catch { /* not up yet */ }
    if (!ws) await wait(200);
  }
  if (!ws) throw new Error("Browser did not start");
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: pathToFileURL(src).href });
  // Wait for the web fonts and images, or the preview renders in fallback fonts.
  await wait(500);
  await send("Runtime.evaluate", { expression: "Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))])", awaitPromise: true });
  await wait(300);
  const shot = await send("Page.captureScreenshot", { format: "jpeg", quality: 88, clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log(`Wrote ${path.relative(process.cwd(), out)} (${W}x${H})`);
  ws.close();
} finally {
  proc.kill();
  await wait(300);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* browser still releasing files */ }
}
