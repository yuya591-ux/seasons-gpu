// 横向きでの情景ギャラリー／設定パネルの収まりを確認する。短い高さで溢れないか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4860'
const VW = parseInt(process.env.VW || '900', 10), VH = parseInt(process.env.VH || '414', 10)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
// 情景ギャラリーを開く
await page.locator('.topbar .iconbtn', { hasText: '情景' }).click().catch(() => {})
await page.waitForTimeout(700)
await page.screenshot({ path: `scripts/_shots/ui-gallery-${VW}x${VH}.png` })
// 閉じて設定を開く
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.locator('.topbar .iconbtn', { hasText: '設定' }).click().catch(() => {})
await page.waitForTimeout(500)
await page.screenshot({ path: `scripts/_shots/ui-settings-${VW}x${VH}.png` })
console.log('ui shots done', VW, VH)
await browser.close()
