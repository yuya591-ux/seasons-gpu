// おやすみタイマーの実証: 暗転フェードが立ち上がり、触れると戻るか。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
// 暗転を即時に起こす
await page.evaluate(() => window.__sleepNow && window.__sleepNow())
await page.waitForTimeout(900)
const fading = await page.evaluate(() => window.__sleepState().fading && window.__sleepState().on)
const opacity1 = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.sleep-overlay')).opacity))
// 触れて戻す
await page.mouse.click(200, 400)
await page.waitForTimeout(500)
const restored = await page.evaluate(() => !window.__sleepState().fading && !window.__sleepState().on)
console.log(`暗転開始: ${fading} | overlay不透明度(上昇中): ${opacity1.toFixed(2)} | 触れて復帰: ${restored ? 'OK' : 'NG'}`)
await browser.close()
