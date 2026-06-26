import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const b = await chromium.launch()
const p = await b.newPage({ viewport:{width:430,height:850} })
const hits=[]
p.on('pageerror',e=>hits.push('PE: '+(e.stack||e.message)))
p.on('console',m=>{ if(m.type()==='error'){ const t=m.text(); if(/初期化|before init|表示失敗|ReferenceError/.test(t)) hits.push('CE: '+t.slice(0,300)) }})
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('autumn-rain-night-corner-room')).catch(()=>{}); await p.waitForTimeout(3000)
console.log(hits.length? hits.slice(0,4).join('\n---\n') : 'no err')
await b.close()
