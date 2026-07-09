import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 900, height: 640 }, deviceScaleFactor: 2.2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
for (const [scene,tag] of [['kitaterao-window-3d-sunset','dusk'],['kitaterao-window-3d','day']]) {
  await p.evaluate(s=>window.__applyScene(s), scene); await p.waitForTimeout(2600)
  // 床の窓際を見下ろす（少しだけ室内へ向き＋下向き）
  await p.evaluate(()=>{ for(let i=0;i<7;i++) window.__town3dLook(24,0); for(let i=0;i<7;i++) window.__town3dLook(0,-24) }); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/shaft-${tag}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
