// 検証: 見本シーン「夏の雨、夕暮れ」を撮影し、背景の二層合成とコンソールエラー有無を確認する。
// 出力名は引数で受ける（before/after を撮り分けるため）。
import { chromium } from 'playwright'

const out = process.argv[2] || 'bg'
const sceneId = process.argv[3] || 'summer-rain-dusk'
const port = process.argv[4] || '4790'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))

await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.__applyScene === 'function', { timeout: 8000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate((id) => window.__applyScene(id), sceneId)
await page.waitForTimeout(2800) // テクスチャ読み込み＋描画の安定待ち
await page.screenshot({ path: `scripts/_shots/${out}.png` })
await browser.close()
console.log(`撮影: scripts/_shots/${out}.png`)
console.log(errors.length ? `コンソールエラー(${errors.length}):\n` + errors.join('\n') : 'コンソールエラー: なし')
