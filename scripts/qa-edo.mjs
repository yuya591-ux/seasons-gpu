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
const E=[640,-46]
// 城の足元・遠景・俯瞰
const shots = [
  ['far',   640-70, 30, -46, 1.3, 0.05],
  ['mid',   640-40, 26, -46, 1.3, 0.1],
  ['base',  640-22, 18, -46, 1.3, 0.0],
  ['town',  640-60, 24, -10, 1.0, 0.0],
]
for (const [name,x,y,z,yaw,pit] of shots){
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/edo-${name}.png` })
}
console.log('castle ground:', JSON.stringify(await p.evaluate(()=>[[640,-46],[630,-46],[650,-46],[640,-36]].map(([x,z])=>({x,z,h:window.__town3dHeights(x,z).heightAt})))))
await b.close()
