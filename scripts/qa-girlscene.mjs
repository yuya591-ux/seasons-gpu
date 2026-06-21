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
const n = await p.evaluate(() => window.__town3dGirlCount ? window.__town3dGirlCount() : 0)
console.log("standees:", n)
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2200)
await p.evaluate(() => { window.__town3dCruise(false); window.__town3dMove(0, 0) })
await p.evaluate(() => window.__town3dZoom(0.5))
await p.waitForTimeout(1600)
const dist = process.argv[2] ? +process.argv[2] : 4
await p.evaluate((d) => window.__town3dGirlFront(0, d), dist)
await p.waitForTimeout(500)
await p.screenshot({ path: `scripts/_shots/girlscene.png` })
console.log(errs.length ? "ERR " + errs.slice(0, 2).join(" | ") : "no errors")
await b.close()
