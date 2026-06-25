import { chromium } from 'playwright'
const PORT = process.env.PORT || 4898
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 820 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
// 各シーン型を巡回
for (const id of ['kitaterao-window-3d','kitaterao-window-3d-night','kitaterao-window-3d-sunset','kitaterao-window-3d-snow','autumn-dusk-corner-room','spring-morning-yato','summer-dusk-downtown']) {
  await page.evaluate((s)=>window.__applyScene(s), id).catch(()=>{})
  await page.waitForTimeout(2200)
  const st = await page.evaluate(()=>window.__town3dStats && window.__town3dStats())
  console.log(id, st?`pr${st.pr} objs${st.objs}`:'-')
}
// 夜シーンで90秒放置（ブルーム＋動物＋イベントのリーク/安定性）
await page.evaluate(()=>window.__applyScene('kitaterao-window-3d-night')); await page.waitForTimeout(2200)
const g0 = await page.evaluate(()=>window.__town3dDraw && window.__town3dDraw())
await page.waitForTimeout(60000)
const g1 = await page.evaluate(()=>window.__town3dDraw && window.__town3dDraw())
console.log('夜60s: calls', g0&&g0.calls, '->', g1&&g1.calls, '/ geoMem', g0&&g0.geoMem, '->', g1&&g1.geoMem)
console.log(errs.length?'エラー: '+JSON.stringify(errs.slice(0,6)):'コンソールエラー無し')
await browser.close()
