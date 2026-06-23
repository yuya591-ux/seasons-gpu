import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())})
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
const S=[140,-640]
// 散歩目線で多数: 谷底の街路/建物/棚田/城/見上げ
const shots = [
  ['street', 140, -636, 0.0, 0.0],      // 谷底の街路を見通す
  ['houses', 148, -636, -0.7, 0.05],    // 侍屋敷の近接
  ['paddy',  120, -650, 0.6, 0.0],      // 棚田の斜面
  ['castle', 150, -660, 0.3, 0.25],     // 城を見上げる
  ['valley', 140, -620, 0.0, -0.05],    // 谷を見渡す
  ['low',    135, -645, 1.2, 0.02],     // 別角度の街路
]
for (const [name,x,z,yaw,pit] of shots) {
  await p.evaluate(([x,z,yaw,pit])=>window.__town3dFlyPose(x,12,z,yaw,pit),[x,z,yaw,pit]); await p.waitForTimeout(900)
  await p.screenshot({ path:`scripts/_shots/sen-${name}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,3).join(' | '):'no errors')
await b.close()
