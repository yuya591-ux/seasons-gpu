// 通い帳（絵日記）の見え方を headless で確認する。localStorage に記録を仕込み、
// 情景→通い帳 を開いてパネルだけを撮る。使い方: node scripts/qa-journal.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || 4939
const BASE = `http://localhost:${PORT}/seasons/`

const srv = spawn(`npx vite preview --port ${PORT} --strictPort`, { shell: true, stdio: 'ignore' })
const cleanup = () => { try { srv.kill() } catch { /* 無視 */ } }
process.on('exit', cleanup)

async function waitServer(ms = 30000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(BASE); if (r.ok) return true } catch { /* まだ */ }
    await new Promise((r) => setTimeout(r, 400))
  }
  return false
}
if (!(await waitServer())) { console.error('JOURNAL: preview server did not start'); cleanup(); process.exit(1) }

const DAY = 86400000
const now = Date.now()
const seed = {
  version: 2,
  sceneId: null,
  settings: {},
  journal: {
    visits: {},
    seen: { 'summer-dusk-seaside': now - 18 * DAY, 'autumn-rain-dusk': now - 12 * DAY, 'summer-morning-mountains': now - 5 * DAY, 'kitaterao-window-3d': now - 2 * DAY },
    seconds: 3 * 3600 + 25 * 60,
    events: { rainbow: 2, star: 1, fireworks: 1 },
    entries: [
      { at: now - 18 * DAY, text: '7月13日、虹がでた。' },
      { at: now - 9 * DAY, text: '7月22日、遠くで花火があがった。' },
      { at: now - 2 * DAY, text: '8月14日、流れ星がながれた。' },
    ],
    firstAt: now - 18 * DAY,
  },
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 140)) })
await page.addInitScript((s) => { localStorage.setItem('seasons.state.v1', JSON.stringify(s)) }, seed)
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1400)
await page.getByRole('button', { name: '情景' }).click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '通い帳' }).click()
await page.waitForTimeout(700)
await page.locator('.panel--journal').screenshot({ path: 'scripts/_shots/journal.png' })
const info = await page.evaluate(() => ({
  lead: document.querySelector('.journal__lead')?.textContent,
  cells: document.querySelectorAll('.journal__cell').length,
  diaryHead: document.querySelector('.journal__diary-head')?.textContent,
  entries: [...document.querySelectorAll('.journal__entry')].map((e) => e.textContent),
}))
console.log(JSON.stringify(info, null, 0))
console.log(errs.length ? 'エラー: ' + JSON.stringify(errs.slice(0, 4)) : 'エラー無し')
await browser.close()
cleanup()
process.exit(0)
