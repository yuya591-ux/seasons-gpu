import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1.6 })
const errs=[]; p.on('pageerror',e=>errs.push(String(e)))
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(700)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')); await p.waitForTimeout(2600)
await p.evaluate(()=>window.__town3dFly(true)); await p.waitForTimeout(700)
const shots = [
  ['taisho-air', -640, 62, 58, 0, -0.42],
  ['taisho-low', -640, 4, 34, 0, -0.05],
  ['edo-air', 640, 66, 64, 0, -0.42],
  ['edo-low', 640, 4, 42, 0, -0.05],
  ['sengoku-air', 140, 58, -566, 0, -0.42],
  ['sengoku-low', 140, 7, -592, 0, -0.05],
]
for (const [tag,x,y,z,yaw,pit] of shots) {
  await p.evaluate(([x,y,z,yaw,pit])=>window.__town3dFlyPose(x,y,z,yaw,pit), [x,y,z,yaw,pit])
  await p.waitForTimeout(1100)
  await p.screenshot({ path:`scripts/_shots/dens-${tag}.png` })
}
console.log(errs.length?'ERR '+errs.slice(0,2):'no errors')
await b.close()
