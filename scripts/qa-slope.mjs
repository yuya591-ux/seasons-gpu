import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4884
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 880, height: 440 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 西/北の周縁の斜面を見渡す（thicketで埋まったか）
const views=[['nw',-90,18,-90,-40,2,-130],['n',-10,16,-95,-10,2,-140],['w',-100,14,-30,-150,2,-30]]
for (const [n,cx,cy,cz,lx,ly,lz] of views){ save(`slope_${n}`, await page.evaluate(([cx,cy,cz,lx,ly,lz])=>window.__town3dShotAt(cx,cy,cz,lx,ly,lz,62),[cx,cy,cz,lx,ly,lz])); console.log(n) }
await browser.close()
