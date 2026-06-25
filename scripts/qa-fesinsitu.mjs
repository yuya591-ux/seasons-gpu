import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 540, height: 720 }, deviceScaleFactor: 2 })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message)); page.on('console',m=>{if(m.type()==='error')errs.push('CE:'+m.text())})
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
// 目の前の広場の盆踊り(0,6)へ寄る
const poses=[['plaza_near',0,3.2,15,0,-0.16],['plaza_side',9,3.4,9,-0.7,-0.16],['park_fes',16,3.6,-16,0,-0.16]]
for(const [n,x,y,z,yw,pt] of poses){ await page.evaluate(([x,y,z,yw,pt])=>window.__town3dFlyPose(x,y,z,yw,pt),[x,y,z,yw,pt]); await page.waitForTimeout(2200); await page.screenshot({path:`scripts/_shots/fesinsitu_${n}.png`}); console.log('shot',n) }
console.log(errs.length?'ERR '+JSON.stringify(errs.slice(0,4)):'no errors')
await browser.close()
