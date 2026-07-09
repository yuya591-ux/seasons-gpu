import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 700, height: 600 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dCruise(false); window.__town3dMove(0, 0) })
const px = process.argv[2] ? +process.argv[2] : -20, py = process.argv[3] ? +process.argv[3] : 14, pz = process.argv[4] ? +process.argv[4] : 4
const pitch = process.argv[5] ? +process.argv[5] : -0.5, yaw = process.argv[6] ? +process.argv[6] : 0
await p.evaluate(([x, y, z, ya, pi]) => window.__town3dFlyPose(x, y, z, ya, pi), [px, py, pz, yaw, pitch])
await p.evaluate(() => window.__town3dZoom(0.42))
await p.waitForTimeout(1400)
await p.screenshot({ path: `scripts/_shots/morooka.png` })
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
