import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
await p.evaluate(()=>window.__town3dCruise(false))
const T=[-640,-30]
const shots = [
  ['over',  -640, 60, 10, 0, -0.5],
  ['eye1',  -640, 20, 8, 3.14, 0.0],
  ['eye2',  -620, 16, -30, -1.57, 0.0],
  ['port',  -640, 18, -55, 0.0, 0.05],
]
for (const [name,x,y,z,yaw,pit] of shots){
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/tai-${name}.png` })
}
console.log('taisho ground:', JSON.stringify(await p.evaluate(()=>[[-640,-30],[-640,-55],[-620,-30],[-660,-10]].map(([x,z])=>({x,z,h:window.__town3dHeights(x,z).heightAt})))))
await b.close()
