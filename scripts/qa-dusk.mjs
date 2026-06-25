import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4894
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 500 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
save('dusk_town', await page.evaluate(()=>window.__town3dShotAt(-30,16,-58,-30,8,-72,50)))
console.log('done')
await browser.close()
