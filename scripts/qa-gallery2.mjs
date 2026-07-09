// 情景ギャラリーの二階層化の検証: 「情景」を開く→場所カード一覧→ある場所を開く→
// 季節・天気・時間ちがいの窓辺が並ぶ→戻る、が破綻なく動くかを撮って確認。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'

const PORT = process.env.PORT || 4953
const BASE = `http://localhost:${PORT}/seasons-gpu/`
mkdirSync('scripts/_shots', { recursive: true })
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) } return false }
if (!(await waitServer())) { console.error('GALLERY: preview did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 640 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1000)

// 「情景」を開く＝場所カード一覧
await page.getByRole('button', { name: '情景' }).first().click()
await page.waitForTimeout(600)
const placeCount = await page.locator('.panel--scene .scene-card').count()
const placeLabels = await page.locator('.panel--scene .scene-card__label').allInnerTexts()
await page.screenshot({ path: 'scripts/_shots/gallery_places.png' })
console.log('PLACES', placeCount, JSON.stringify(placeLabels))

// 先頭の場所（北寺尾の坂の街）を開く＝その場所の窓辺の一覧
await page.locator('.panel--scene .scene-card').first().click()
await page.waitForTimeout(600)
const varCount = await page.locator('.panel--scene .scene-card').count()
const hasBack = await page.locator('.panel--scene .gallery__back').count()
await page.screenshot({ path: 'scripts/_shots/gallery_variants.png' })
console.log('VARIANTS', varCount, 'back=', hasBack)

// 戻る
await page.locator('.panel--scene .gallery__back').click()
await page.waitForTimeout(500)
const backCount = await page.locator('.panel--scene .scene-card').count()
console.log('BACK-TO-PLACES', backCount)

console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'GALLERY OK: エラー無し')
await browser.close(); cleanup(); process.exit(0)
