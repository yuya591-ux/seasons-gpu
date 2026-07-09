import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4886
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 480 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 川を水際から見る
let gy = await page.evaluate(() => window.__town3dGroundAt(-40, -20))
save('water_river', await page.evaluate(([gy]) => window.__town3dShotAt(-40, gy+2.0, -8, -47, gy+0.2, -40, 60), [gy]))
// 公園の池
gy = await page.evaluate(() => window.__town3dGroundAt(14, -19))
save('water_pond', await page.evaluate(([gy]) => window.__town3dShotAt(14, gy+2.2, -10, 16, gy+0.2, -22, 55), [gy]))
console.log('done')
await browser.close()
