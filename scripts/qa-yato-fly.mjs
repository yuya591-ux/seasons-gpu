// 谷戸を谷筋に沿って低く飛ぶ視点＝棚田の段々が霞に沈まず色を保つか確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('shishigaya-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(0.9); window.__town3dFlyPose(0, 16, 14, 0, -0.32) })
await page.waitForTimeout(1100)
await page.screenshot({ path: 'scripts/_shots/yato-fly.png' })
console.log('谷戸フライ撮影 done')
await browser.close()
