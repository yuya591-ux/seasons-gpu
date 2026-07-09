import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
const snap = async (tag) => {
  await p.waitForTimeout(2200) // 移動平均を落ち着かせる
  const d = await p.evaluate(()=>({ draw:window.__town3dDraw&&window.__town3dDraw(), stats:window.__town3dStats&&window.__town3dStats(), load:window.__town3dLoad&&window.__town3dLoad() }))
  const D=d.draw||{}, S=d.stats||{}, L=d.load||{}
  console.log(`${tag.padEnd(14)} calls=${D.calls} tris=${(D.tris/1000).toFixed(0)}k jsMs=${L.jsMs} DPR=${S.pr} objs=${S.objs} texN=${D.texMem} | residents=${L.residents} walkers=${L.cityWalkers} birds=${L.birds} trees=${L.trees} clouds=${L.clouds}`)
}
await snap('window')
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dFlyPose(2,6,-18,Math.PI,-0.05)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await snap('home-walk')
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(300)
await p.evaluate(()=>window.__town3dFlyPose(0,40,40,Math.PI,-0.2)).catch(()=>{}); await snap('home-flyLow')
await p.evaluate(()=>window.__town3dFlyPose(0,120,90,Math.PI,-0.3)).catch(()=>{}); await snap('home-flyHigh')
await p.evaluate(()=>window.__town3dFlyPose(-636,24,-13,Math.PI,-0.1)).catch(()=>{}); await p.waitForTimeout(2500)
await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await snap('taisho-walk')
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
