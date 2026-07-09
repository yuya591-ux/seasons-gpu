import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4888
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 中央通りを歩行目線で見通す（舗装・センターライン）
let gy = await page.evaluate(() => window.__town3dGroundAt(0, -8))
save('road_central', await page.evaluate(([gy])=>window.__town3dShotAt(0, gy+1.6, -6, 0, gy+1.0, -46, 60), [gy]))
// 住宅街の路地
gy = await page.evaluate(() => window.__town3dGroundAt(22, -50))
save('road_alley', await page.evaluate(([gy])=>window.__town3dShotAt(22, gy+1.6, -46, 22, gy+1.0, -66, 60), [gy]))
console.log('done')
await browser.close()
