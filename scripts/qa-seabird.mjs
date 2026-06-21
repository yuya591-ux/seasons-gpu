import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
await p.waitForTimeout(1600)
// home上空（陸の上）でのオブジェクト数
const homeStats = await p.evaluate(() => { window.__town3dFlyPose(20, 26, -36, Math.PI, -0.2); return window.__town3dStats() })
await p.waitForTimeout(700)
const objBefore = (await p.evaluate(() => window.__town3dStats())).objs
// 海の上（home と 江戸 のあいだ）へ
await p.evaluate(() => window.__town3dFlyPose(400, 18, -46, 0.785, -0.08))
await p.waitForTimeout(1800) // 数フレーム海上で過ごす＝渡りの群れが湧く
const seaStats = await p.evaluate(() => window.__town3dStats())
await p.screenshot({ path: "scripts/_shots/seabird-sea.png" })
console.log("home上空 objs:", objBefore, "/ tris", homeStats.tris, "calls", homeStats.calls)
console.log("海上 objs:", seaStats.objs, "(差分", seaStats.objs - objBefore, "→ 群れ19体ぶん増えていれば渡りの鳥が出現)")
console.log(errs.length ? "ERRORS: " + errs.slice(0, 3).join(" | ") : "no errors")
await b.close()
