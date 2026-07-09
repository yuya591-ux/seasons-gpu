import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 560 }, deviceScaleFactor: 1 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2800)
const ms = async (label) => { await p.waitForTimeout(1500); const l = await p.evaluate(()=>window.__town3dLoad&&window.__town3dLoad()); console.log(label.padEnd(16), 'jsMs='+l.jsMs, 'res='+l.residents, 'crit='+l.critters, 'walk='+l.cityWalkers, 'trees='+l.trees) }
await ms('indoor/window')
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(800)
await p.evaluate(()=>window.__town3dCruise(true))
await p.waitForTimeout(2000)
await ms('cruise home')
await p.evaluate(()=>window.__town3dFlyPose(140,18,-640,0,0)); await p.evaluate(()=>window.__town3dCruise(true)); await ms('cruise Sengoku')
await b.close()
