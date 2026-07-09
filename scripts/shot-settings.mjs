// 設定パネルを開いて撮る（おやすみタイマー等のUI確認）。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.locator('.topbar .iconbtn', { hasText: '設定' }).click().catch(() => {})
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/settings.png' })
await browser.close()
console.log('settings.png 撮影')
