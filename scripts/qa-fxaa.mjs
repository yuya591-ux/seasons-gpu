import { chromium } from "playwright"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 470 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto("http://localhost:4801/seasons-gpu/?dev=1", { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
await p.evaluate(() => window.__applyScene("kitaterao-window-3d"))
await p.waitForTimeout(2600)
await p.screenshot({ path: "scripts/_shots/fxaa-window.png" }) // 窓辺（色の正しさ確認）
await p.evaluate(() => window.__town3dFly(true))
await p.waitForTimeout(2400)
await p.evaluate(() => window.__town3dCruise(false))
await p.waitForTimeout(1800)
await p.screenshot({ path: "scripts/_shots/fxaa-fly.png" }) // 上空一望（ギザギザ確認）
console.log(errs.length ? "ERR " + errs.slice(0, 3).join(" | ") : "no errors")
await b.close()
