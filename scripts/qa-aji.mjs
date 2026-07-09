import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:800} })
const errs=[]; p.on('pageerror',e=>errs.push('PE:'+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text().slice(0,200))})
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1500)
// home（夏）: 大正運河・home川辺・ひまわりの生成経路を踏む
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
console.log('home ok, hook:', await p.evaluate(()=>typeof window.__town3dShotAt==='function'))
// 谷戸（夏）: せせらぎの紫陽花の生成経路を踏む
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d')).catch(()=>{}); await p.waitForTimeout(3000)
console.log('yato ok, hook:', await p.evaluate(()=>typeof window.__town3dShotAt==='function'))
console.log(errs.length?('ERR\n'+errs.slice(0,6).join('\n')):'no console err')
await b.close()
