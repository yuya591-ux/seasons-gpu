import { chromium } from 'playwright'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(800)
await page.evaluate(() => { window.__town3dCruise(false) })
// shotAtで遠景建物群を斜め上から（生WebGL=グレード無しだが影は見える）
const dat = await page.evaluate(() => window.__town3dShotAt(70, 26, 30, 95, 4, -30, 50))
const fs = await import('fs')
fs.writeFileSync('scripts/_shots/t6b.png', Buffer.from(dat.split(',')[1], 'base64'))
console.log('done')
await browser.close()
