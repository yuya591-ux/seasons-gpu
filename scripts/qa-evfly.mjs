import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 860 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
await p.waitForTimeout(1400)
// 江戸とhomeの間の海上へ。進行方向を東(+x)へ向けて静止。
await p.evaluate(() => window.__town3dFlyPose(380, 22, -46, 1.5708, -0.08))
await p.waitForTimeout(600)
const dbg = await p.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log("dbg:", JSON.stringify(dbg))
// 雨を起こす（自分の周りに降るはず）
await p.evaluate(() => window.__town3dEvent("rain"))
await p.waitForTimeout(2600)
await p.screenshot({ path: "scripts/_shots/evfly-rain.png" })
// 鳥の群れ
await p.evaluate(() => window.__town3dEvent("birds"))
await p.waitForTimeout(1400)
await p.screenshot({ path: "scripts/_shots/evfly-birds.png" })
// 気球
await p.evaluate(() => window.__town3dEvent("balloon"))
await p.waitForTimeout(1200)
await p.screenshot({ path: "scripts/_shots/evfly-balloon.png" })
console.log(errs.length ? "ERR: " + errs.slice(0, 3).join(" | ") : "no errors")
await b.close()
