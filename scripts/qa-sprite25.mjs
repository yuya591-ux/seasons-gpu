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
// 屋外視点（窓台の遮蔽なし）でカメラを静止
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2200)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dZoom(0.65))
await p.waitForTimeout(1800)
const dist = process.argv[2] ? +process.argv[2] : 4.5
const angs = [["front", 0], ["q34", 0.785], ["side", 1.5708], ["q34b", 2.356], ["back", 3.14159]]
for (const [name, rel] of angs) {
  await p.evaluate((d) => window.__town3dSpriteFront(0, d, true), dist)
  await p.evaluate((r) => window.__town3dSpriteFace(0, r), rel)
  await p.waitForTimeout(450)
  await p.screenshot({ path: `scripts/_shots/s25-${name}.png` })
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
