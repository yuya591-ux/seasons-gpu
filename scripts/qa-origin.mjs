import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
await p.evaluate(() => { window.__town3dFly(true) })
await p.evaluate(() => { window.__town3dCruise(false) })
// 大正のレール(z=-30)を低空・側面から＝電車が線路上に居るか
await p.evaluate(() => window.__town3dFlyPose(-690, 12, -22, -Math.PI/2, -0.05))
await p.waitForTimeout(1600)
await p.screenshot({ path: "scripts/_shots/aud-tram-fixed.png" })
await b.close()
