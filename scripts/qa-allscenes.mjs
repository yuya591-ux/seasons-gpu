import { chromium } from 'playwright'
const PORT = process.env.PORT || 4807
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 800 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1500)
for (const id of ['kitaterao-window-3d','kitaterao-window-3d-night','shishigaya-morning-yato','shishigaya-window-3d','autumn-dusk-corner-room','spring-dusk-corner-room']) {
  await page.evaluate((s)=>window.__applyScene(s), id).catch(()=>{})
  await page.waitForTimeout(2400)
  const ok = await page.evaluate(()=>typeof window.__town3dStats==='function' ? 'mounted' : 'no-hook')
  console.log(id, ok)
}
console.log(errs.length?'ERR '+JSON.stringify(errs.slice(0,5)):'コンソールエラー無し')
await browser.close()
