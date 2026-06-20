// 看板の文字が描画されるか、低空・近接で確認（江戸の市場・大正の通り）。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-spring'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(700)
await page.evaluate(() => { window.__town3dCruise(false) })
await page.evaluate(() => window.__town3dFlyPose(432, 7, -30, Math.PI / 2, 0.02)); await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/signs-edo.png' })
await page.evaluate(() => window.__town3dFlyPose(-455, 8, -28, -Math.PI / 2, 0.02)); await page.waitForTimeout(700)
await page.screenshot({ path: 'scripts/_shots/signs-taisho.png' })
console.log('signs shots done')
await browser.close()
