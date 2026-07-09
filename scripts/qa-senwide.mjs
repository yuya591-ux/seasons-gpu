import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
for (const [name,x,y,z,yaw,pit] of [['wide',140,75,-540,0,-0.6],['eye',146,0,-648,-0.5,-0.02],['walk',150,0,-652,1.4,-0.05]]){
  let yy=y; if(y===0){ yy = await p.evaluate(([x,z])=>window.__town3dHeights(x,z).heightAt+2.2,[x,z]) }
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,yy,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/senwide-${name}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
