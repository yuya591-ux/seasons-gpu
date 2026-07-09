// 全公開情景を一括フルフレーム撮影（品質点検用）。プレビュー(:4790, ?dev=1)起動中に実行。
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync('scripts/_shots/all', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto('http://localhost:4790/seasons-gpu/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const ids = await page.evaluate(() => window.__sceneIds || [])
for (const id of ids) {
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `scripts/_shots/all/${id}.png` })
}
console.log('撮影:', ids.length, '情景 | errors:', errs.filter((e) => /shader|compile|失敗/i.test(e)).length)
await browser.close()
