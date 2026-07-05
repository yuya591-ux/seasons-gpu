// 開発サーバー(vite dev)に対する全情景エラーチェック＝安全網。
// 自前でvite previewをspawnする qa-smoke.mjs が本環境で不安定なため、既に起動中のdevサーバー(既定4917)へ当てる版。
// 使い方: 別途 `npx vite --port 4917` を起動しておき、`PORT=4917 node scripts/qa-smoke-dev.mjs`
import { chromium } from 'playwright'
import { SCENES } from '../src/data/scenes/index.js'
const PORT = process.env.PORT || 4917
const BASE = `http://localhost:${PORT}/seasons/`
const ids = SCENES.filter((s) => s.status === 'ready' && s.public !== false).map((s) => s.id)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 720 } })
const bad = []
let curId = '(start)'
const isErr = (m) => !/favicon|manifest|Download the React|preload/i.test(m)
page.on('pageerror', (e) => bad.push({ id: curId, msg: 'PE:' + e.message }))
page.on('console', (m) => { if (m.type() === 'error' && isErr(m.text())) bad.push({ id: curId, msg: 'CE:' + m.text().slice(0, 160) }) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
const hasHook = await page.evaluate(() => typeof window.__applyScene === 'function')
if (!hasHook) { console.error('SMOKE-DEV: __applyScene hook missing'); await browser.close(); process.exit(1) }
let scanned = 0
for (const id of ids) {
  curId = id
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(700)
  await page.evaluate((i) => window.__applyScene(i), id)
  await page.waitForTimeout(1400)
  scanned++
}
await browser.close()
if (bad.length) {
  console.error(`SMOKE-DEV FAIL: ${bad.length} 件の異常（情景 ${scanned}枚を走査）`)
  for (const b of bad.slice(0, 20)) console.error(`  [${b.id}] ${b.msg}`)
  process.exit(1)
}
console.log(`SMOKE-DEV OK: ${scanned} 情景すべてエラー無し`)
process.exit(0)
