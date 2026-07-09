import { chromium } from "playwright"
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
const idx = process.argv[3] ? +process.argv[3] : 35 // harbor girl は終盤に追加=後ろの方
// 屋外の静止カメラ（飛んでから巡航を止める＝実績のある手順）
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dCruise(false); window.__town3dMove(0, 0) })
await p.evaluate(() => window.__town3dZoom(0.5))
await p.waitForTimeout(1600)
const dist = process.argv[2] ? +process.argv[2] : 3.4
const angs = [["front", 0], ["q34", 0.7], ["side", 1.5708]]
for (const [name, ya] of angs) {
  await p.evaluate(([d, i]) => window.__town3dResFront(i, d), [dist, idx])
  await p.evaluate(([y, i]) => window.__town3dResFace(i, y), [ya, idx])
  await p.waitForTimeout(420)
  await p.screenshot({ path: `scripts/_shots/char-${name}.png` })
  await p.screenshot({ path: `scripts/_shots/char-${name}-face.png`, clip: { x: 130, y: 60, width: 230, height: 230 } })
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
