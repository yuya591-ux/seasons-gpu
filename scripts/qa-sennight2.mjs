import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-night'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
for (const [name,x,z,yaw,pit,eye] of [['n-street',144,-646,-0.4,0.02,1.8],['n-compose',132,-636,0.5,-0.04,6.0]]){
  const y = await p.evaluate(([x,z,eye])=>window.__town3dHeights(x,z).heightAt + eye, [x,z,eye])
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/seneval-${name}.png` })
}
console.log('done')
await b.close()
