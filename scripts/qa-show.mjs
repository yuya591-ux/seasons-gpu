import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4888
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 480 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 駅前一帯（緑の地面・人だかり・バス停・木）を歩行目線で
let gy = await page.evaluate(() => window.__town3dGroundAt(31, -22))
save('show_station', await page.evaluate(([gy])=>window.__town3dShotAt(31, gy+1.7, -22, 31, gy+1.2, -42, 66), [gy]))
// 公園の池辺
gy = await page.evaluate(() => window.__town3dGroundAt(14, -16))
save('show_park', await page.evaluate(([gy])=>window.__town3dShotAt(14, gy+1.8, -10, 16, gy+0.8, -26, 64), [gy]))
console.log('done')
await browser.close()
