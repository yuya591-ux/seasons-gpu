// 猫の顔をはっきり撮る（起きてこちらを見る＝目が開く）。デザイン評価用の近接。
import { chromium } from 'playwright'
const port = process.env.PORT || '5118'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 640 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(500)
await page.addStyleTag({ content: '.ui{display:none !important}' })
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dCatReact('lookback')) // 起きてこちらを見る（目が開く）
await page.evaluate(() => window.__town3dSetView(0.32, -0.62)); await page.waitForTimeout(1200) // 猫へ寄って見下ろす
await page.screenshot({ path: 'scripts/_shots/catface-now.png' })
console.log('catface done')
await browser.close()
console.log('check done')
