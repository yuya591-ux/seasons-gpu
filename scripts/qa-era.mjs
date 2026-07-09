import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
// 各エリア近傍の地面高さ
const gh = await p.evaluate(()=>{
  const g=window.__town3dGroundAt; const pts=[['taisho',-636,-8],['taisho2',-628,-40],['sengoku',140,-628],['sengoku2',128,-648],['edo',628,-46],['edo2',640,-34]]
  return pts.map(([t,x,z])=>({t,x,z,y:g?+g(x,z).toFixed(1):null}))
})
console.log(JSON.stringify(gh))
await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
const spots=[['taisho',-636,-8],['sengoku',140,-628],['edo',628,-46]]
for(const [tag,x,z] of spots){
  await p.evaluate(([x,z])=>window.__town3dFlyPose(x,24,z,0,-0.06),[x,z]).catch(()=>{}); await p.waitForTimeout(600)
  await p.evaluate(()=>window.__town3dLand && window.__town3dLand(true)).catch(()=>{}); await p.waitForTimeout(2400)
  await p.screenshot({ path:`era-${tag}.png` }); console.log('shot '+tag)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
}
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
