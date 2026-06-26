import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:560,height:560} })
const errs=[]; p.on('pageerror',e=>errs.push(e.message))
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
// 公園(14,-22)を俯瞰で見て、ベージュの平面の正体を確認
await p.evaluate(()=>window.__town3dShotAt(14, 34, 14, 14, 4, -22, 60)).catch(()=>{}); await p.waitForTimeout(500)
await p.screenshot({ path: 'park-aerial.png' }); console.log('aerial')
// 地面高さと付近の状況
const info = await p.evaluate(()=>{
  const g = window.__town3dGroundAt
  const pts = [[14,-22],[10,-26],[18,-18],[14,-30],[8,-18]]
  return pts.map(([x,z])=>({x,z,y: g?+g(x,z).toFixed(2):null}))
})
console.log(JSON.stringify(info))
console.log(errs.length?('ERR '+errs.slice(0,2).join(' | ')):'no err')
await b.close()
