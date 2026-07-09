import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:840} })
const reqs=new Set(); const errs=[]
p.on('response',r=>{const u=r.url(); if(u.includes('/audio/')&&u.endsWith('.mp3')) reqs.add(r.status()+' '+u.split('/audio/')[1])})
p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80))})
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
for(const id of ['photo-window-autumn','photo-window-spring','photo-window-night','kitaterao-window-3d-autumn']){ await p.evaluate(s=>window.__applyScene(s),id).catch(()=>{}); await p.waitForTimeout(2200) }
await p.waitForTimeout(600)
console.log([...reqs].join('\n'))
console.log(errs.length?'ERR '+errs.slice(0,4).join('|'):'no console err')
await b.close()
