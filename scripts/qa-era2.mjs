import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850}, deviceScaleFactor:2, isMobile:true, hasTouch:true })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
async function shoot(tag,x,y,z,yaw){
  await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
  await p.evaluate(()=>window.__town3dFly && window.__town3dFly(true)).catch(()=>{}); await p.waitForTimeout(400)
  // 近くでホバリングして un-cull を待つ
  await p.evaluate(([x,y,z,yaw])=>window.__town3dFlyPose(x,y,z,yaw,-0.16),[x,y,z,yaw]).catch(()=>{}); await p.waitForTimeout(3200)
  await p.screenshot({ path:`era2-${tag}.png` }); console.log('shot '+tag)
}
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await shoot('sengoku',140,20,-612,0.1)   // 戦国の谷を見下ろす
await shoot('edo',628,12,-30,0.3)        // 江戸の城下を低く
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
