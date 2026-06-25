import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4898
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1000, height: 540 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 住宅街を斜め上から（灯る窓のブルーム＋窓割りの変化＋緑）
save('show_night', await page.evaluate(()=>window.__town3dShotAt(-26, 11, -54, -26, 5, -70, 52)))
console.log('done')
await browser.close()
