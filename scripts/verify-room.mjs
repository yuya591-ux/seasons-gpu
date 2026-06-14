// 部屋スプラットが（fade-in/GPUソート判定/下地色の変更後も）描画されるか、長めに待って確認する。
import { chromium } from 'playwright'
const BASE = 'http://localhost:4790/seasons/?dev=1' + (process.argv[2] || '') // 診断を出して状態を見る
import { mkdirSync } from 'node:fs'
mkdirSync('scripts/_shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(300)
await page.locator('.scene-card:has-text("ある部屋の窓辺")').click()
await page.waitForTimeout(12000) // フェッチ+パース+描画を十分待つ
await page.screenshot({ path: `scripts/_shots/room_long${(process.argv[2] || '').replace(/[^a-z0-9]/gi, '')}.png`, timeout: 90000 })
const diag = await page.locator('.splat-diag').innerText().catch(() => '(診断なし)')
console.log('--- 診断 ---\n' + diag)
await browser.close()
if (errors.length) { console.log('ERR:'); errors.forEach((e) => console.log('  ' + e)); process.exit(1) }
console.log('コンソールエラー無し ✓')
