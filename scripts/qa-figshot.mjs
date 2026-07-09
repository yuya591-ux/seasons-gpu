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
const has = await p.evaluate(() => !!window.__town3dFigShot)
if (!has) { console.log("ERR: __town3dFigShot missing"); await b.close(); process.exit(1) }
// yaw 0=正面（顔）/ 0.7=斜め前 / 1.57=横 / 3.14=後ろ
const views = [["front", 0], ["q34", 0.6], ["side", 1.5708], ["back", 3.14159]]
for (const [name, yaw] of views) {
  const url = await p.evaluate((y) => window.__town3dFigShot(y), yaw)
  if (url) fs.writeFileSync(`scripts/_shots/fig-${name}.png`, Buffer.from(url.split(",")[1], "base64"))
}
// 顔アップ
for (const [name, yaw] of [["front", 0], ["q34", 0.6]]) {
  const url = await p.evaluate((y) => window.__town3dFigShot(y, null, true), yaw)
  if (url) fs.writeFileSync(`scripts/_shots/figface-${name}.png`, Buffer.from(url.split(",")[1], "base64"))
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
