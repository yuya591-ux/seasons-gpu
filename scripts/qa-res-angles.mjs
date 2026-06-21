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
const n = await p.evaluate(() => (window.__town3dResInfo ? window.__town3dResInfo().length : 0))
console.log("residents:", n)
if (!n) { console.log("NO RESIDENTS"); await b.close(); process.exit(0) }
// 飛行モードへ（窓台/花瓶の遮蔽が無い屋外視点で人物を撮る）。自動巡航は止めてカメラを静止させる。
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2200)
await p.evaluate(() => window.__town3dCruise(false))
await p.evaluate(() => window.__town3dZoom(0.7)) // 少し寄る
await p.waitForTimeout(1800)
const dist = process.argv[2] ? +process.argv[2] : 8
const angs = [["front", 0], ["q34", 0.8], ["side", 1.5708], ["back", 3.14159]]
for (const [name, ya] of angs) {
  await p.evaluate((d) => window.__town3dResFront(0, d), dist) // 毎回カメラ正面へ置き直す
  await p.evaluate((y) => window.__town3dResFace(0, y), ya)
  await p.waitForTimeout(450)
  await p.screenshot({ path: `scripts/_shots/ra-${name}.png` })
}
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
