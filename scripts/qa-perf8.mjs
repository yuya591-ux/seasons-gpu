// 窓辺ビュー(最重2101コール)の内訳: カテゴリ寄与とメッシュ集中箇所を特定する
import { chromium } from 'playwright'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2500)
const attr = await page.evaluate(() => window.__town3dAttribute())
console.log('カテゴリ寄与:', JSON.stringify(attr))
const histo = await page.evaluate(() => { const h = window.__town3dMeshHisto ? window.__town3dMeshHisto() : null; if (!h) return null; if (h.perChild) h.perChild = h.perChild.slice(0, 14); return h })
console.log('メッシュ集中:', JSON.stringify(histo))
await browser.close()
console.log('qa-perf8 done')
