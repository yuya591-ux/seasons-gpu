import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', e => console.log('PAGEERR', e.message))
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night')) // 夜の雲海
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
await page.addStyleTag({ content: '[class*="toast"],[class*="hint"],[class*="cruise"],[class*="gauge"],[class*="modepill"],[class*="town3d-low"],[class*="town3d-stick"]{display:none!important}' })
// 雲海の島・橋の高さ(SEA_Y=88, 島はSEA_Y+18=106付近)を複数角度で
const poses = [[ -30, 100, -250, 0, 0.05 ], [ 0, 108, -312, -0.3, -0.1 ], [ 90, 100, -312, 1.4, 0.0 ], [ -34, 96, -346, 0.2, 0.2 ]]
for (let i=0;i<poses.length;i++){ await page.evaluate(p=>window.__town3dFlyPose(p[0],p[1],p[2],p[3],p[4]), poses[i]); await page.waitForTimeout(1100); await page.screenshot({ path:`scripts/_shots/blackcloud_${i}.png` }) }
console.log('done')
await browser.close()
