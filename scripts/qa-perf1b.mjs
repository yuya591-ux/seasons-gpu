import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dFlyPose(0, 28, 60, 0, -0.25) }); await page.waitForTimeout(1200)
await page.addStyleTag({ content: '.ui,[class*="toast"],[class*="hint"],[class*="cruise"],[class*="modepill"]{display:none !important}' })
await page.screenshot({ path: 'scripts/_shots/perf1_home.png' })
// 住人が長め窓で動くか
const a = await page.evaluate(() => window.__town3dResInfo().map(r => r.x+','+r.z+','+r.face))
await page.waitForTimeout(4000)
const b = await page.evaluate(() => window.__town3dResInfo().map(r => r.x+','+r.z+','+r.face))
let moved = 0; for (let i=0;i<a.length;i++) if (a[i]!==b[i]) moved++
console.log('residents total', a.length, 'moved in 4s', moved)
await browser.close()
