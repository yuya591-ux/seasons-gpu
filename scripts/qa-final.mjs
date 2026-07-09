import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 460, height: 820 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
for (const id of ['kitaterao-window-3d','kitaterao-window-3d-night','autumn-dusk-corner-room','spring-morning-yato','summer-dusk-downtown']) {
  await page.evaluate((s)=>window.__applyScene && window.__applyScene(s), id).catch(()=>{})
  await page.waitForTimeout(2600)
  const clip = await page.evaluate(()=>window.__town3dResClip && window.__town3dResClip())
  console.log(id, clip?`res${clip.resIn}/peep${clip.peepIn} (R${clip.residents}/P${clip.peeps})`:'(no town3d hook)')
}
console.log(errs.length?'ERR '+JSON.stringify(errs.slice(0,6)):'コンソールエラー無し')
await browser.close()
