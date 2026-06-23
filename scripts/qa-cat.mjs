import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 720, height: 1280 }, deviceScaleFactor: 2 })
await p.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await p.locator('.gate').click().catch(()=>{})
await p.waitForTimeout(800)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d-sunset'))
await p.waitForTimeout(3000)
for (const r of ['lookback','stretch','roll','tailUp','wiggle','yawn']){
  await p.evaluate((r)=>window.__town3dCatReact(r), r); await p.waitForTimeout(1000) // ~中間
  await p.screenshot({ path:`scripts/_shots/cat-${r}.png`, clip:{x:0,y:760,width:720,height:520} })
  await p.waitForTimeout(1600) // 反応終わるまで待つ
}
console.log('done')
await b.close()
