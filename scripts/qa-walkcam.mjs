// 歩行カメラの検証: 着地して歩行モードに入り、引いた三人称の「空気感」カメラが
// クリップ/ジオラマ化せず、街を広く望めているかを本物のグレード込みで撮る（page.screenshot）。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = process.env.PORT || 4952
const BASE = `http://localhost:${PORT}/seasons/`
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
mkdirSync('scripts/_shots', { recursive: true })
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) } return false }
if (!(await waitServer())) { console.error('WALKCAM: preview did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 480 } }) // 横持ち相当
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate((s) => window.__applyScene && window.__applyScene(s), SCENE)
await page.waitForTimeout(2600)
// 昼にして見やすく
await page.evaluate(() => window.__town3dDrift && window.__town3dDrift(0.15))
// 飛び立ってから着地＝歩行モードへ
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true))
await page.waitForTimeout(2400)
await page.evaluate(() => window.__town3dLand && window.__town3dLand(true))
await page.waitForTimeout(2600)

// 平らな中央通り(x≈0, z≈-25付近)へ歩いて移動して撮る＝丘の下り坂の錯視でなく、通常の平地の見え。
// カメラの向き(camYaw)を北=街の奥(-z)へ合わせ、前進スティックで真っ直ぐ歩かせる。
await page.evaluate(() => { window.__town3dFaceWalk && window.__town3dFaceWalk(0) }) // 進む向き=-z(街の奥)
await page.evaluate(() => { window.__town3dLook && window.__town3dLook(-999, 0) }) // camYawを北へ寄せる（横に大きく振っておく）
await page.waitForTimeout(200)
async function walk(ms) { await page.evaluate(() => window.__town3dMove && window.__town3dMove(0, -1)); await page.waitForTimeout(ms); await page.evaluate(() => window.__town3dMove && window.__town3dMove(0, 0)); await page.waitForTimeout(400) }
await walk(4200) // 平地の中央通りへ下る
let dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('AFTER-WALK', JSON.stringify(dbg))
await page.screenshot({ path: 'scripts/_shots/walkcam_move.png' }) // 平地での三人称
// 立ち止まって少し待つ＝「腰をおろす」前の静止の見え
await page.waitForTimeout(1400)
await page.screenshot({ path: 'scripts/_shots/walkcam_still.png' })
// 見回し（右ドラッグ相当）で少し上下＝画角と追従の確認
await page.evaluate(() => { window.__town3dLook && window.__town3dLook(0.15, 0) })
await page.waitForTimeout(600)
await page.screenshot({ path: 'scripts/_shots/walkcam_turn.png' })

dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
console.log('DBG', JSON.stringify(dbg))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'WALKCAM OK: エラー無し')
await browser.close(); cleanup(); process.exit(0)
