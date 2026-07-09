import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 820 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(3000)
let maxP=0, ex=[]
for (let i=0;i<10;i++){ await page.waitForTimeout(1000); const r=await page.evaluate(()=>window.__town3dResClip()); maxP=Math.max(maxP,r.peepIn); if(r.peepIn) ex=r.bad; console.log(`t+${i+1}s peepIn=${r.peepIn} resIn=${r.resIn}`) }
console.log('maxPeepIn', maxP, 'ex', JSON.stringify(ex))
// 食い込み座標のコライダー詳細
if(ex.length){ for(const b of ex.filter(x=>x.t==='peep').slice(0,3)){ const pr=await page.evaluate(([x,z])=>window.__town3dProbe(x,z),[b.x,b.z]); console.log(`(${b.x},${b.z})`, JSON.stringify(pr.near&&pr.near.slice(0,3))) } }
await browser.close()
