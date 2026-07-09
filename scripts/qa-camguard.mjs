import { chromium } from 'playwright'
import fs from 'node:fs'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 480, height: 420 }, deviceScaleFactor: 1.5 })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1000)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await p.waitForTimeout(2600)
await p.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await p.waitForTimeout(600)
// 埋没が起きていた低空・斜面ぎわの構図を再現して、実カメラ(三人称)の絵を撮る
const spots = {
  'homehill': [6, 12, 24, Math.PI],      // 現代homeの手前の丘ぎわを低空で背に
  'homeslope': [-30, 10, -10, 0.6],      // 谷へ下る斜面の低空
  'edolow': [640, 18, -20, Math.PI],     // 江戸の城の丘を低空で見上げ
  'sengokulow': [140, 16, -610, 0.2],    // 戦国の谷の斜面低空
  'yatolow': [0, 9, 4, Math.PI * 0.5],   // 谷戸の里山ぎわ低空
}
for (const [name, s] of Object.entries(spots)) {
  await p.evaluate((a) => window.__town3dFlyPose(a[0], a[1], a[2], a[3], 0), s)
  await p.waitForTimeout(900) // カメラが落ち着くまで
  const dbg = await p.evaluate(() => window.__town3dDbg())
  await p.screenshot({ path: `${OUT}\\camg-${name}.png` })
  console.log(name, 'y=' + dbg.y, 'shot')
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await b.close()
