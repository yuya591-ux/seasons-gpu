import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
// 中層ビルが多いエリアを俯瞰（パラペット/屋上色の変化を確認）。home中心の市街地寄り
const dat = await page.evaluate(() => window.__town3dShotAt(20, 30, 55, 0, 5, 0, 52))
writeFileSync('scripts/_shots/t9_roofs.png', Buffer.from(dat.split(',')[1], 'base64'))
console.log('done')
await browser.close()
