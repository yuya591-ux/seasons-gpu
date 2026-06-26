import { chromium } from 'playwright'
const PORT = process.env.PORT || 4930
const b = await chromium.launch(); const p = await b.newPage()
await p.goto(`http://localhost:${PORT}/seasons/?dev=1`,{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
const info = await p.evaluate(()=>{
  const g=window.__town3dGroundAt; if(!g) return 'no hook'
  // 東の汀を横断: z=20 固定で x を海方向へ。SEA.level=-10。浜=海面より少し上(-9..0)の平坦帯があるか
  const row=[]; for(let x=58;x<=84;x+=2){ row.push({x, y:+g(x,20).toFixed(2)}) }
  return row
})
console.log(JSON.stringify(info))
await b.close()
