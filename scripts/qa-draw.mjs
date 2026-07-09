import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:840} })
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
const draw = async (tag)=>{ const d = await p.evaluate(()=>window.__town3dDraw?window.__town3dDraw():null); console.log(tag, JSON.stringify(d)) }
await draw('窓辺')
await p.evaluate(()=>window.__town3dFlyPose(0,28,40,Math.PI,-0.15)).catch(()=>{}); await p.waitForTimeout(2000); await draw('低空home')
await p.evaluate(()=>window.__town3dFlyPose(140,18,-600,Math.PI,-0.1)).catch(()=>{}); await p.waitForTimeout(2000); await draw('戦国低空')
await p.evaluate(()=>window.__town3dFlyPose(640,18,-30,Math.PI,-0.1)).catch(()=>{}); await p.waitForTimeout(2000); await draw('江戸低空')
await p.evaluate(()=>window.__town3dFlyPose(-20,120,-250,Math.PI,-0.2)).catch(()=>{}); await p.waitForTimeout(2000); await draw('雲海')
await b.close()
