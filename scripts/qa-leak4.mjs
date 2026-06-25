import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 480, height: 840 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://localhost:4922/seasons/?dev=1', { waitUntil: 'domcontentloaded', timeout: 60000 })
await p.locator('.gate').click().catch(() => {}); await p.waitForTimeout(1200)
await p.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await p.waitForTimeout(3000)
const draw = () => p.evaluate(() => window.__town3dDraw ? window.__town3dDraw() : null)
const base = await draw(); console.log('baseline', JSON.stringify(base))
const evs = ['birds', 'balloon', 'star', 'contrail', 'cloudShade', 'duskLights', 'rainbow', 'mist', 'godRays', 'drift', 'fireworks', 'fireworksFinale', 'aurora', 'milkyway', 'rain', 'wetRoad']
for (let r = 0; r < 4; r++) { for (const e of evs) { await p.evaluate(n => window.__town3dEvent && window.__town3dEvent(n), e).catch(() => {}); await p.waitForTimeout(25) } }
console.log('fired 4x each. waiting 95s for all to finish...')
const peak = await draw(); console.log('peak', JSON.stringify(peak))
await p.waitForTimeout(95000)
const end = await draw()
console.log('after95s', JSON.stringify(end))
console.log('RESIDUAL dCalls', end.calls - base.calls, 'dTex', end.texMem - base.texMem, 'dGeo', end.geoMem - base.geoMem, 'dProgs', end.progs - base.progs)
console.log(errs.length ? 'ERR ' + errs.slice(0, 2).join(' | ') : 'no err')
await b.close()
