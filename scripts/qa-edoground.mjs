import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4802
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 820, height: 480 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
// 近づいてfog reveal
await page.evaluate(()=>window.__town3dFlyPose(640, 30, 20, 0, -0.2)); await page.waitForTimeout(2500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
const spots=[[675,-20],[610,-66],[660,-20]]
for (let i=0;i<spots.length;i++){ const [x,z]=spots[i]; const gy=await page.evaluate(([x,z])=>window.__town3dGroundAt(x,z),[x,z])
  save(`edog_${i}`, await page.evaluate(([x,gy,z])=>window.__town3dShotAt(x, gy+1.7, z+7, x, gy+0.5, z-12, 60),[x,gy,z])); console.log(i,'gy',gy.toFixed(1)) }
await browser.close()
