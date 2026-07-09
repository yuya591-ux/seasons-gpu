import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4882
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 500 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 中央の商店街通り(0,-25)を低く見る（歩く人）
let gy = await page.evaluate(() => window.__town3dGroundAt(0, -10))
save('street_arcade', await page.evaluate(([gy]) => window.__town3dShotAt(0, gy+2.2, -2, 0, gy+1.2, -40, 50), [gy]))
await browser.close()
