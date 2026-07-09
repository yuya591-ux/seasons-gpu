// 遠雷フラッシュの確認: 夏の雨・夕暮れで uFlash を立ち上げ、発光の有無を撮り比べる。
import { chromium } from 'playwright'
const BASE = 'http://localhost:4790/seasons-gpu/?dev=1'
import { mkdirSync } from 'node:fs'
mkdirSync('scripts/_shots', { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(BASE, { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts.ready)
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
// 既定情景＝夏の雨、夕暮れ（rainGlass）。発光前を撮影
await page.screenshot({ path: 'scripts/_shots/flash_off.png' })
// フラッシュを立ち上げ、立ち上がり直後を撮影
await page.evaluate(() => window.__renderer && window.__renderer.triggerFlash(1.0))
await page.waitForTimeout(60)
await page.screenshot({ path: 'scripts/_shots/flash_on.png' })

// 夜の下町（windowTown）でもフラッシュが効くか
await page.locator('button:has-text("情景")').click()
await page.waitForTimeout(300)
await page.locator('.scene-card:has-text("夏の雨の夜、高台の下町")').click()
await page.waitForTimeout(1200)
await page.screenshot({ path: 'scripts/_shots/flash_town_off.png' })
await page.evaluate(() => window.__renderer && window.__renderer.triggerFlash(1.0))
await page.waitForTimeout(60)
await page.screenshot({ path: 'scripts/_shots/flash_town_on.png' })

await browser.close()
const ok = !errors.length
console.log(ok ? 'コンソールエラー無し ✓' : 'ERR:\n' + errors.join('\n'))
if (!ok) process.exit(1)
