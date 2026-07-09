import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4897
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 460 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
const Y=90
await page.evaluate((Y)=>{ window.__town3dQuadPin(0,-1.5,0,Y,0.6); window.__town3dQuadPin(1,1.5,0,Y,2.4) }, Y)
await page.waitForTimeout(500)
save('quadsky', await page.evaluate((Y)=>window.__town3dShotAt(0, Y+0.6, 5, 0, Y+0.4, 0, 30), Y))
console.log('done')
await browser.close()
