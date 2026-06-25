import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 520, height: 760 }, deviceScaleFactor: 2 })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('summer-night-downtown'))
await page.waitForTimeout(3000)
const fc = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount())
console.log('folk', fc)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
const poses = [['plaza',0,5,16,0,-0.2],['park',16,6,-12,0,-0.25],['school',54,6,-2,0,-0.25]]
for (const [n,x,y,z,yw,pt] of poses){ await page.evaluate(([x,y,z,yw,pt])=>window.__town3dFlyPose(x,y,z,yw,pt),[x,y,z,yw,pt]); await page.waitForTimeout(2200); await page.screenshot({path:`scripts/_shots/fly_${n}.png`}); console.log('shot',n) }
await browser.close()
