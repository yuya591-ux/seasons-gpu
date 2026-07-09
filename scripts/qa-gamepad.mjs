// ゲームパッド対応A の検証。合成ゲームパッド(navigator.getGamepads を上書き)を注入し、
// スティック/ボタン入力→既存アクションの発火を headless で確認する。実機の握り心地は別途 Backbone One で。
// 使い方: node scripts/qa-gamepad.mjs （PORT=4961 上書き可）。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4961
const BASE = `http://localhost:${PORT}/seasons-gpu/`

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => { for (let i = 0; i < 120; i++) { try { const r = await fetch(BASE); if (r.ok) return true } catch {} await new Promise((r) => setTimeout(r, 250)) } throw new Error('preview not ready') }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  await waitReady()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
  const errs = []
  page.on('pageerror', (e) => errs.push('PE:' + String(e)))
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|manifest|preload/i.test(m.text())) errs.push('CE:' + m.text()) })
  await page.goto(BASE + '?dev=1', { waitUntil: 'networkidle' })
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
  for (let i = 0; i < 40; i++) { const ok = await page.evaluate(() => typeof window.__town3dGp === 'function' && !!window.__town3dGp()); if (ok) break; await sleep(250) }

  // 合成ゲームパッド注入（標準配置・17ボタン・4軸）
  await page.evaluate(() => {
    window.__fp = { id: 'FakePad', index: 0, connected: true, mapping: 'standard', timestamp: 0,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }
    navigator.getGamepads = () => [window.__fp]
  })
  await sleep(300) // 接続検出（フェードclass＋pad=true）

  const gp = () => page.evaluate(() => window.__town3dGp())
  const hasClass = () => page.evaluate(() => !!document.querySelector('.town3d-stage--pad'))
  const setAxis = (i, v) => page.evaluate(([i, v]) => { window.__fp.axes[i] = v }, [i, v])
  const press = async (i) => { await page.evaluate((i) => { window.__fp.buttons[i] = { pressed: true, touched: true, value: 1 } }, i); await sleep(120); await page.evaluate((i) => { window.__fp.buttons[i] = { pressed: false, touched: false, value: 0 } }, i); await sleep(120) }
  const hold = async (i, v = 1) => page.evaluate(([i, v]) => { window.__fp.buttons[i] = { pressed: v > 0.5, touched: true, value: v } }, [i, v])
  const release = async (i) => page.evaluate((i) => { window.__fp.buttons[i] = { pressed: false, touched: false, value: 0 } }, i)

  const results = []
  const check = (name, cond, got) => { results.push({ name, ok: !!cond, got }); console.log((cond ? 'OK  ' : 'NG  ') + name + '  ' + JSON.stringify(got)) }

  const s0 = await gp()
  check('接続検出(pad=true & fadeClass)', s0 && s0.pad === true && (await hasClass()), { pad: s0 && s0.pad })
  check('初期モード=window', s0 && s0.mode === 'window', { mode: s0 && s0.mode })

  await press(0) // A（窓辺）→ 飛び立つ
  let s = await gp(); check('A(窓辺)→飛行へ', s.mode === 'fly', { mode: s.mode })

  const cruise0 = (await gp()).cruise
  await press(0) // A（飛行）→ すすむ/とまる
  s = await gp(); check('A(飛行)→cruiseトグル', s.cruise !== cruise0, { before: cruise0, after: s.cruise })

  await press(1) // B → 低く流す
  s = await gp(); check('B(飛行)→低く流す', s.low === true, { low: s.low })

  await press(3) // Y → 広く
  s = await gp(); check('Y(飛行)→広く', s.wide === true, { wide: s.wide })

  const zoom0 = (await gp()).zoom
  await press(5) // R1 → 寄る（zoom×0.8で下がる）
  s = await gp(); check('R1(飛行)→寄る(zoom減)', s.zoom < zoom0, { before: zoom0, after: s.zoom })

  await hold(7, 1) // R2 → 上昇（アナログ）
  await sleep(160); s = await gp(); check('R2(飛行)→上昇(climb>0)', s.climb > 0.1, { climb: s.climb })
  await release(7); await sleep(160); s = await gp(); check('R2離す→climb=0', Math.abs(s.climb) < 0.05, { climb: s.climb })

  await press(2) // X → 着地して歩く
  s = await gp(); check('X(飛行)→歩行へ', s.mode === 'walk', { mode: s.mode })

  await press(0) // A（歩行）→ ジャンプ（状態は一過性。エラーが出ないことを確認）
  s = await gp(); check('A(歩行)ジャンプ後もwalk維持', s.mode === 'walk', { mode: s.mode })

  await press(8) // VIEW → 窓辺へ戻る
  s = await gp(); check('VIEW→窓辺へ戻る', s.mode === 'window', { mode: s.mode })

  // ── キーコンフィグ(Phase B): 設定パネルを開き、A を別ボタンへ再割当→保存→既定に戻す ──
  const padCfgVisible = await page.evaluate(() => { const b = document.querySelector('.town3d-padcfg-btn'); return !!b && getComputedStyle(b).display !== 'none' })
  check('接続で「⚙コントローラー」表示', padCfgVisible, { visible: padCfgVisible })
  await page.evaluate(() => document.querySelector('.town3d-padcfg-btn').click()); await sleep(250) // パネルを開く（evaluateで直接click＝オーバーレイに邪魔されない）
  check('既定マップ A=0', (await gp()).map.A === 0, { A: (await gp()).map.A })
  await page.evaluate(() => { for (const b of document.querySelectorAll('.town3d-padcfg button')) if (b.textContent === '変更') { b.click(); break } }); await sleep(150) // 最初の行(A)の「変更」（パネル内に限定）
  check('割当キャプチャ開始(cap=A)', (await gp()).cap === 'A', { cap: (await gp()).cap })
  await press(5) // ボタン5を押す → A へ割り当て
  check('A をボタン5へ再割当', (await gp()).map.A === 5, { A: (await gp()).map.A })
  const saved = await page.evaluate(() => localStorage.getItem('seasons_padmap'))
  check('localStorage へ保存', !!saved && JSON.parse(saved).A === 5, { saved })
  await page.evaluate(() => { for (const b of document.querySelectorAll('.town3d-padcfg button')) if (b.textContent === '既定に戻す') { b.click(); break } }); await sleep(150)
  check('既定に戻す(A=0)', (await gp()).map.A === 0, { A: (await gp()).map.A })

  const ng = results.filter((r) => !r.ok)
  console.log('---')
  console.log('errs:', errs.length); if (errs.length) console.log(errs.slice(0, 6).join('\n'))
  console.log('NG:', ng.length, ng.map((r) => r.name).join(' / '))
  await browser.close()
  process.exit(errs.length || ng.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
