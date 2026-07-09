import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
const Y = 90
// peep×3を正面向き(face=PI 客側)で並べ、住人1体も
await page.evaluate((Y) => { window.__town3dPeepPin(0, -1.6, 0, Math.PI, Y); window.__town3dPeepPin(5, 0, 0, Math.PI, Y); window.__town3dPeepPin(10, 1.6, 0, Math.PI, Y); window.__town3dResPin(0, 3.4, 0, Math.PI, Y) }, Y)
await page.waitForTimeout(600)
// 引いて全身（頭〜足）。中心高さ Y+0.85、距離7
let d = await page.evaluate((Y) => window.__town3dShotAt(0.9, Y + 0.95, 7.5, 0.9, Y + 0.85, 0, 26), Y); save('sky_full', d)
// 簡易peep単体・大きめ
d = await page.evaluate((Y) => window.__town3dShotAt(0, Y + 0.95, 4.2, 0, Y + 0.82, 0, 24), Y); save('sky_peep1', d)
console.log('done')
await browser.close()
