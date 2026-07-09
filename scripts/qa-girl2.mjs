import { chromium } from "playwright"
import fs from "fs"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
const has = await p.evaluate(() => !!window.__girlPNG2)
if (!has) { console.log("ERR: __girlPNG2 missing"); await b.close(); process.exit(1) }
const url = await p.evaluate(() => window.__girlPNG2())
if (url) fs.writeFileSync("scripts/_shots/girl2.png", Buffer.from(url.split(",")[1], "base64"))
const urlf = await p.evaluate(() => window.__girlPNG2(null, true))
if (urlf) fs.writeFileSync("scripts/_shots/girl2-face.png", Buffer.from(urlf.split(",")[1], "base64"))
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
