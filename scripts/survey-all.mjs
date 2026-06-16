// 全ready情景を一括撮影して品質を見渡す（評価・改善点の洗い出し用）。出力: scripts/_shots/survey/<id>.png
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const port = process.env.PORT || '4830'
mkdirSync('scripts/_shots/survey', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errsByScene = {}
let curScene = '(init)'
page.on('pageerror', (e) => { (errsByScene[curScene] ||= []).push(String(e).slice(0, 120)) })
page.on('console', (m) => { if (m.type() === 'error') (errsByScene[curScene] ||= []).push(m.text().slice(0, 120)) })
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
const ids = await page.evaluate(() => window.__sceneIds || [])
console.log('情景数:', ids.length)
await page.addStyleTag({ content: '.ui{display:none !important}' })
for (const id of ids) {
  curScene = id
  await page.evaluate((sid) => window.__applyScene(sid), id)
  await page.waitForTimeout(2200)
  await page.screenshot({ path: `scripts/_shots/survey/${id}.png` })
  console.log('撮影:', id, errsByScene[id] ? `⚠ errors=${errsByScene[id].length}` : '')
}
await browser.close()
console.log('\n=== エラーのあった情景 ===')
for (const [k, v] of Object.entries(errsByScene)) console.log(k, '→', v.slice(0, 2).join(' | '))
console.log('完了')
