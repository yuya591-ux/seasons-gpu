// 本番(GitHub Pages)の実機検証: まっさらなブラウザで「夏の雨、夕暮れ」を開き、
// Flux背景が反映されているかを撮影する（キャッシュ/SWの影響を受けない新規コンテキスト）。
import { chromium } from 'playwright'

const URL = 'https://yuya591-ux.github.io/seasons-gpu/?dev=1'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message))
page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`) })

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForFunction(() => typeof window.__applyScene === 'function', { timeout: 10000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => window.__applyScene('summer-rain-dusk'))
await page.waitForTimeout(3000) // 本番からの画像取得＋描画安定待ち
await page.screenshot({ path: 'scripts/_shots/live_bg.png' })
await browser.close()
console.log('撮影: scripts/_shots/live_bg.png')
console.log(errors.length ? `コンソールエラー(${errors.length}):\n` + errors.join('\n') : 'コンソールエラー: なし')
