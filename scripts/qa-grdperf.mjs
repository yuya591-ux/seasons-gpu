import { chromium } from 'playwright'
const PORT = process.env.PORT || 4878
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 480, height: 820 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['kitaterao-window-3d','kitaterao-window-3d-night','kitaterao-window-3d-snow','spring-morning-yato']) {
  await page.evaluate((s)=>window.__applyScene(s), id).catch(()=>{})
  await page.waitForTimeout(2400)
  const d = await page.evaluate(()=>window.__town3dDraw && window.__town3dDraw())
  console.log(id, d?`calls${d.calls} tris${(d.tris/1000|0)}k`:'-')
}
console.log(errs.length?'ERR '+JSON.stringify(errs.slice(0,5)):'no errors')
await browser.close()
