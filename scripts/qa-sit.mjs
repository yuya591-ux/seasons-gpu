// 「腰をおろす」検証: 立体の街で歩行に入り、しばらく動かずにいると sitAmt が 0→~1 へ上がり、
// カメラがそっと下がること・静かな鈴(chime)が満ちることを確認する。使い方: node scripts/qa-sit.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 4941
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)
async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ } await new Promise((r) => setTimeout(r, 400)) }
  return false
}
if (!(await waitServer())) { console.error('SIT: preview server did not start'); cleanup(); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 760 } })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.goto(`${BASE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2500)

// 窓をあける→乗り出す→空へ→地上、と段階ボタンを押して歩行へ。
// モードピル(空を飛ぶ/地上を歩く)を見ながら適応的に進める（遷移待ち＋force click）。
const stage = page.locator('.iconbtn--stage')
const mode = () => page.evaluate(() => (document.querySelector('.modepill')?.textContent || '').trim())
for (let i = 0; i < 8; i++) {
  const m = await mode()
  if (/地上を歩く/.test(m)) break // 歩行に到達
  const label = await stage.textContent().catch(() => '?')
  await stage.click({ force: true }).catch(() => {})
  console.log(`step${i + 1}: 「${label}」押下 / mode=「${m}」`)
  await page.waitForTimeout(3000)
}
console.log('到達mode=「' + (await mode()) + '」')
const sitStand = await page.evaluate(() => (window.__town3dSit ? window.__town3dSit() : -1)) // 歩行直後（立っている）
const c0 = await page.evaluate(() => (window.__town3dSoundCounts ? window.__town3dSoundCounts().chime : -1))

// 動かずに待つ（mouseを隅でわずかに動かしてCSSのidle黒画面だけ避ける＝歩行velは不変なので腰はおろす）
for (let s = 0; s < 18; s++) { await page.mouse.move(8 + (s % 2), 8); await page.waitForTimeout(900) }
const sitDown = await page.evaluate(() => (window.__town3dSit ? window.__town3dSit() : -1)) // 立ち止まって佇んだ後
const c1 = await page.evaluate(() => (window.__town3dSoundCounts ? window.__town3dSoundCounts().chime : -1))
await page.screenshot({ path: 'scripts/_shots/sit.png' })

console.log(JSON.stringify({ sitStand, sitDown, chimeBefore: c0, chimeAfter: c1 }))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
