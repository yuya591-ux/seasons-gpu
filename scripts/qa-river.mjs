import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 川を間近で見下ろす（護岸と川幅の確認）
for (const [name,x,z,yaw,pit] of [['close',144,-650,1.4,-0.25],['walk',146,-648,-0.4,-0.05]]){
  const y = await p.evaluate(([x,z])=>window.__town3dHeights(x,z).heightAt + 2.0, [x,z])
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/river-${name}.png` })
}
console.log('done')
await b.close()
