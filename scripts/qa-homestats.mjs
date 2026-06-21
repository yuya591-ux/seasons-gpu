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
await p.evaluate(() => window.__town3dFlyPose(0, 55, -20, Math.PI, -0.4))
await p.waitForTimeout(900)
console.log("home stats:", JSON.stringify(await p.evaluate(() => window.__town3dStats && window.__town3dStats())))
await b.close()
