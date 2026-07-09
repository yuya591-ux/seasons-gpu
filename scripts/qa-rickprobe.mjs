import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
const info = await p.evaluate(()=>{
  const g=window.__town3dGroundAt; if(!g) return 'no hook'
  // 人力車スポット: (-649,-8),(-633,-8),(-622,-18). SEA.level=-10。skip条件: heightAt<SEA.level+0.8=-9.2
  return [[-649,-8],[-633,-8],[-622,-18]].map(([x,z])=>({x,z,y:+g(x,z).toFixed(2), ok:g(x,z) >= -9.2}))
})
console.log(JSON.stringify(info))
await b.close()
