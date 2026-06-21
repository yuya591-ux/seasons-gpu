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
// カメラを固定姿勢に（ドリフト防止）
await p.evaluate(() => window.__town3dFlyPose(0, 26, 32, 0, -0.04))
await p.evaluate(() => { window.__town3dCruise(false); window.__town3dMove(0, 0) })
await p.evaluate(() => window.__town3dZoom(0.55))
await p.waitForTimeout(1200)
const dist = process.argv[2] ? +process.argv[2] : 3
const angs = [["front", 0], ["q34", 0.785], ["side", 1.5708], ["back", 3.14159]]
for (const [name, rel] of angs) {
  await p.evaluate((d) => window.__town3dSpriteFront(0, d, true), dist)
  await p.evaluate((r) => window.__town3dSpriteFace(0, r), rel)
  await p.waitForTimeout(420)
  await p.screenshot({ path: `scripts/_shots/s25b-${name}.png` })
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
