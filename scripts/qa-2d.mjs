// 2Dシェーダーの窓辺シーン群を点検（旗艦=夏雨夕方ほか）。既定（窓辺）の見え方を撮る。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const scenes = [
  'summer-rain-dusk', 'summer-rain-night', 'autumn-rain-dusk',
  'summer-dusk-downtown', 'summer-dusk-seaside', 'summer-morning-mountains',
  'summer-clear-noon', 'shishigaya-morning-yato',
]
for (const id of scenes) {
  await page.evaluate((s) => window.__applyScene(s), id)
  await page.waitForTimeout(2600)
  await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
  await page.screenshot({ path: `scripts/_shots/2d-${id}.png` })
  console.log(id, 'done')
}
await browser.close()
console.log('2d done')
