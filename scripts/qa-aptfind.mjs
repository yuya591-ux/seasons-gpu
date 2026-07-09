import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4888
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 800, height: 560 } })
await page.goto(`http://localhost:${PORT}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(500)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// 住宅街を斜め上から数枚（ベランダ付きの陸屋根アパートを探す）
const v=[['a',-30,16,-58,-30,8,-72],['b',30,16,-66,30,8,-80],['c',-60,18,-50,-60,8,-66],['d',50,16,-58,50,8,-72]]
for (const [n,cx,cy,cz,lx,ly,lz] of v){ save(`af_${n}`, await page.evaluate(([cx,cy,cz,lx,ly,lz])=>window.__town3dShotAt(cx,cy,cz,lx,ly,lz,48),[cx,cy,cz,lx,ly,lz])); console.log(n) }
await browser.close()
