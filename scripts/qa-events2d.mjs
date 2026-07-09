// 2D（シェーダー）情景の流れ星イベント確認。summer-dusk-seaside（夏/clear/dusk）で流れ星が流れる。
import { chromium } from 'playwright'
const port = process.env.PORT || '5050'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((s) => window.__applyScene(s), 'summer-dusk-seaside')
await page.waitForTimeout(2200)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const hasHook = await page.evaluate(() => !!(window.__events2d && window.__events2d.testStar))
console.log('hook?', hasHook)
// 流れ星を手動発火し、尾が伸びる途中を捉える
await page.evaluate(() => window.__events2d.testStar())
await page.waitForTimeout(260)
await page.screenshot({ path: 'scripts/_shots/evt2d-star.png' })
console.log('star shot done')
await browser.close()
console.log('check done')
