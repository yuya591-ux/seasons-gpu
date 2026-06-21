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
const shot = async (x,y,z,yaw,pit,name) => { await p.evaluate(([x,y,z,ya,pi]) => window.__town3dFlyPose(x,y,z,ya,pi),[x,y,z,yaw,pit]); await p.waitForTimeout(800); await p.screenshot({ path: `scripts/_shots/${name}.png` }) }
await shot(-52, 14, -20, Math.PI, -0.1, "ev-river")
await shot(-40, 12, -30, Math.PI/2, -0.06, "ev-resi")
await shot(20, 28, -36, Math.PI, -0.25, "ev-overview")
await b.close()
