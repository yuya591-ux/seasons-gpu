import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const scene = process.env.SCENE || 'kitaterao-window-3d-sunset'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 2 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate((s)=>window.__applyScene(s), scene)
await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(600)
await p.evaluate(()=>window.__town3dCruise(false))
// [name, x, y, z, yaw, pitch]
const shots = [
  // 戦国: 川沿いの家を低く / 城の足元 / 谷を見渡す
  ['sen-river',   140, 5,  -632, 0.0,  0.06],
  ['sen-river2',  146, 5,  -636, 1.6,  0.05],
  ['sen-castle',  158, 9,  -642, 0.55, 0.12],
  ['sen-castbase',164, 6,  -646, 0.4,  0.0],
  // 現代home: 街路に立って道と家 / 俯瞰
  ['home-st1',    0,   2,  -18,  0.0,  0.02],
  ['home-st2',    6,   2,  -30,  1.57, 0.0],
  ['home-st3',   -8,   2,  -40,  3.1,  0.0],
  ['home-low',    0,   14, -10,  0.0, -0.15],
]
for (const [name,x,y,z,yaw,pit] of shots) {
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit),[x,y,z,yaw,pit]); await p.waitForTimeout(800)
  await p.screenshot({ path:`scripts/_shots/coh-${name}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,3).join(' | '):'no errors')
await b.close()
