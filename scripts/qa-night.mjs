import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4892
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 560 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
save('night_apt', await page.evaluate(()=>window.__town3dShotAt(-30,16,-58,-30,8,-72,48)))
console.log('done')
await browser.close()
