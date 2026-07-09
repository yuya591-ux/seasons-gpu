import { chromium } from "playwright"
import fs from "fs"
const port = process.env.PORT || "4801"
const a = process.argv.slice(2).map(Number)
const [cx, cy, cz, lx, ly, lz, fov] = a.length >= 6 ? a : [-6, 7, -9, -20, 3.5, -20, 55]
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2500)
const url = await p.evaluate((args) => window.__town3dShotAt(...args), [cx, cy, cz, lx, ly, lz, fov || 55])
if (url) fs.writeFileSync("scripts/_shots/shotat.png", Buffer.from(url.split(",")[1], "base64"))
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "ok")
await b.close()
