import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:520,height:680}, deviceScaleFactor:2 })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
// 夏(既定)＋秋で並木を見る。大正 tx=-640, tz=-30, 運河 cz0=tz+17=-13
for(const [tag,scene] of [['summer','kitaterao-window-3d'],['autumn','kitaterao-window-3d-autumn']]){
  await p.evaluate(s=>window.__applyScene(s),scene).catch(()=>{}); await p.waitForTimeout(2700)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
  // 運河を見下ろしながら長手(x)方向に並木を見る
  await p.evaluate(()=>window.__town3dFlyPose(-664, 7, -13, Math.PI/2, -0.18)).catch(()=>{}); await p.waitForTimeout(1500)
  await p.screenshot({ path:`avenue-${tag}.png` }); console.log(tag)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
