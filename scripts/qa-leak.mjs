import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 480, height: 840 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://localhost:4922/seasons/?dev=1', { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1200)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await p.waitForTimeout(2600)
const draw = () => p.evaluate(() => window.__town3dDraw ? window.__town3dDraw() : null)
const d0 = await draw(); console.log('start', JSON.stringify(d0))
const evs = ['birds', 'balloon', 'star', 'contrail', 'cloudShade', 'duskLights', 'rainbow', 'mist', 'godRays', 'drift', 'fireworks', 'fireworksFinale', 'aurora', 'milkyway', 'rain']
for (let round = 0; round < 6; round++) {
  for (const e of evs) { await p.evaluate(n => window.__town3dEvent && window.__town3dEvent(n), e).catch(() => {}); await p.waitForTimeout(50) }
  const d = await draw(); console.log('round' + round, JSON.stringify(d))
}
await p.waitForTimeout(3000)
const d1 = await draw(); console.log('final', JSON.stringify(d1))
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await b.close()
