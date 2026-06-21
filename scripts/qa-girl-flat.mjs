import { chromium } from "playwright"
import fs from "fs"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2200)
const has = await p.evaluate(() => !!window.__girlPNG)
if (!has) { console.log("ERR: __girlPNG missing"); await b.close(); process.exit(1) }
for (const view of ["front", "q34", "side", "back"]) {
  const v = view === "q34" ? "front" : view // 3/4はまだ正面で代用
  const url = await p.evaluate((vv) => window.__girlPNG(vv), v)
  fs.writeFileSync(`scripts/_shots/gf-${view}.png`, Buffer.from(url.split(",")[1], "base64"))
}
console.log(errs.length ? "ERR: " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
