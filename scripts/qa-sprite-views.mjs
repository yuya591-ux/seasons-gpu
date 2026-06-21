import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
// スプライト0をカメラ正面に立たせる
const dist = process.argv[2] ? +process.argv[2] : 5
await p.evaluate((d) => window.__town3dSpriteFront && window.__town3dSpriteFront(0, d, true), dist)
await p.waitForTimeout(400)
const views = [["front", 0], ["q34", 0.7], ["side", 1.5708], ["sideL", -1.5708], ["back", 3.14159]]
for (const [name, rel] of views) {
  await p.evaluate((r) => window.__town3dSpriteFace && window.__town3dSpriteFace(0, r), rel)
  await p.waitForTimeout(500)
  await p.screenshot({ path: `scripts/_shots/sv-${name}.png` })
}
console.log(errs.length ? "ERR: " + errs.slice(0, 3).join(" | ") : "no errors")
await b.close()
