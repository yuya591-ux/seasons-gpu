// 発熱ベンチ(bench.html)の動作検証: WebGL/WebGPU両モードを短時間(8秒)走らせ、
// コンソールエラー0・描画コール2100・fps/CPU時間の実数値・スクショを確認する。
// 使い方: node scripts/qa-bench.mjs （要: 事前に npx vite build）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PORT = process.env.PORT || 4971
const BASE = `http://localhost:${PORT}/seasons-gpu/`
const OUT = path.join(ROOT, '.qa-shots', 'bench')
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, shell: true })
process.on('exit', () => { try { srv.kill() } catch {} })
const waitReady = async () => {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(BASE); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview not ready')
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  await waitReady()
  // WebGPU用フラグ付きで起動（WebGLにも無害）。ヘッドレスはWebGPUアダプタが出ないことがあるため
  // HEADED=1 で実ウィンドウ起動（本物のWebGPU経路をデスクトップGPUで確認する用）。
  const browser = await chromium.launch({
    headless: process.env.HEADED !== '1',
    args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan'],
  })
  let bad = 0

  for (const mode of ['webgl', 'webgpu']) {
    const page = await browser.newPage({ viewport: { width: 720, height: 560 } })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e)))
    page.on('console', (m) => {
      const loc = (m.location() && m.location().url) || ''
      if (m.type() === 'error' && !/favicon|manifest/i.test(m.text() + ' ' + loc)) errs.push(`${m.text()} @${loc}`)
    })
    await page.goto(`${BASE}bench.html?mode=${mode}&secs=8`, { waitUntil: 'networkidle' })
    await sleep(11000)
    const st = await page.evaluate(() => window.__benchStats && window.__benchStats())
    await page.screenshot({ path: path.join(OUT, `${mode}.png`) })
    // 合格基準: フレームが進む・エラー0。描画コール2100はWebGL(現行方式)のみ厳密確認
    // （WebGPURenderer系はinfoの数え方が backend で異なるため参考値扱い）。
    const ok = st && st.frames > 30 && errs.length === 0 && (mode !== 'webgl' || st.calls >= 2100)
    if (!ok) bad++
    console.log(`[${mode}] ${ok ? 'OK' : 'NG'} backend=${st?.backend} frames=${st?.frames} fps=${st?.fps?.toFixed(1)} jsMs=${st?.jsMs?.toFixed(2)} calls=${st?.calls} tris=${st?.trisDrawn} errs=${errs.length}`)
    if (errs.length) console.log('  ' + errs.slice(0, 3).join('\n  '))
    if (st?.errors?.length) console.log('  page-errors: ' + st.errors.join(' / '))
    await page.close()
  }

  console.log('OUT:', OUT)
  await browser.close()
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
