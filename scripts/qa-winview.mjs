import { chromium } from "playwright"
const port = process.env.PORT || "4801"
const scenes = process.argv[2] ? process.argv[2].split(",") : ["kitaterao-window-3d", "autumn-dusk-corner-room"]
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 880 }, deviceScaleFactor: 2 })
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: "networkidle" })
await p.locator(".gate").click().catch(() => {})
await p.waitForTimeout(700)
for (const s of scenes) {
  await p.evaluate((sid) => window.__applyScene(sid), s)
  await p.waitForTimeout(2600)
  await p.screenshot({ path: `scripts/_shots/win-${s}-rest.png` })
  // 窓をあけて身を乗り出す（あれば）
  await p.evaluate(() => window.__town3dWindow && window.__town3dWindow(true))
  await p.waitForTimeout(1300)
  await p.evaluate(() => window.__town3dLean && window.__town3dLean(true))
  await p.waitForTimeout(1700)
  await p.screenshot({ path: `scripts/_shots/win-${s}-lean.png` })
  await p.evaluate(() => window.__town3dLean && window.__town3dLean(false))
  await p.evaluate(() => window.__town3dWindow && window.__town3dWindow(false))
  await p.waitForTimeout(800)
}
console.log(errs.length ? "ERR: " + errs.slice(0, 3).join(" | ") : "no errors")
await b.close()
