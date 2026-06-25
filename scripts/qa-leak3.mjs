import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 480, height: 840 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://localhost:4922/seasons/?dev=1', { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1200)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await p.waitForTimeout(2600)
const draw = () => p.evaluate(() => window.__town3dDraw ? window.__town3dDraw() : null)
// 短尺イベントのみ（20秒待てば完全終了するはず）。基準に戻らなければ真のリーク。
const evs = ['star', 'fireworks', 'contrail', 'rainbow', 'godRays', 'birds', 'wetRoad', 'cloudShade']
for (const e of evs) {
  const a = await draw()
  for (let i = 0; i < 20; i++) { await p.evaluate(n => window.__town3dEvent && window.__town3dEvent(n), e).catch(() => {}); await p.waitForTimeout(30) }
  await p.waitForTimeout(20000) // 完全終了まで待つ
  const c = await draw()
  console.log(e.padEnd(12), 'dTex', (c.texMem - a.texMem), 'dGeo', (c.geoMem - a.geoMem), 'dCalls', (c.calls - a.calls), 'dProgs', (c.progs - a.progs))
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await b.close()
