import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 600 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
// 街道沿いの低い目線で屋台を探す
for (const [name,x,z,yaw] of [['s1',138,-636,-0.9],['s2',132,-642,0.0],['s3',148,-628,-2.3]]){
  const y = await p.evaluate(([x,z])=>window.__town3dHeights(x,z).heightAt + 1.5, [x,z])
  await p.evaluate(([x,y,z,yaw])=>window.__town3dFlyPose(x,y,z,yaw,0.0),[x,y,z,yaw]); await p.waitForTimeout(700)
  await p.screenshot({ path:`scripts/_shots/stall-${name}.png` })
}
console.log('done')
await b.close()
