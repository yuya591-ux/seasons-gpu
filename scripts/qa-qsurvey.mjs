// 品質二極化の調査: 全公開情景を「実際の見え方」(CSSグレード/ブルーム込みのpage.screenshot)で
// サムネ撮影し、旗艦と見劣りする情景を洗い出す。第一印象=既定視点で撮る。
import { chromium } from 'playwright'
import { SCENES } from '../src/data/scenes/index.js'
const port = process.env.PORT || '5121'
const ids = SCENES.filter((s) => s.status === 'ready' && s.public !== false).map((s) => ({ id: s.id, render: s.render }))
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 560 }, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const { id, render } of ids) {
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(700)
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(1600)
  await page.mouse.move(210, 280); await page.mouse.move(212, 282) // idle間引き回避
  await page.waitForTimeout(300)
  await page.screenshot({ path: `scripts/_shots/q-${id}.png` })
  console.log('shot', id, render || '?')
}
await browser.close()
console.log('qsurvey done', ids.length)
