import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
const PORT = process.env.PORT || 4801
const era = process.argv[2] || 'edo'
const C = { edo:[640,-46], sengoku:[140,-640], taisho:[-640,-30] }[era]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 900, height: 460 } })
const errs=[]; page.on('pageerror',e=>errs.push('PE:'+e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(200)
const save = (name, durl) => writeFileSync(`scripts/_shots/${name}.png`, Buffer.from(durl.split(',')[1], 'base64'))
// エリア上空へ近づく（fog reveal）→低空で数枚
const [cx,cz]=C
await page.evaluate(([cx,cz])=>window.__town3dFlyPose(cx, 40, cz+70, 0, -0.2),[cx,cz]); await page.waitForTimeout(2500)
await page.evaluate(([cx,cz])=>window.__town3dFlyPose(cx, 16, cz+40, 0, -0.14),[cx,cz]); await page.waitForTimeout(2500)
await page.screenshot({ path: `scripts/_shots/era_${era}_low.png` })
// 着地して歩行目線
const gy = await page.evaluate(([cx,cz])=>window.__town3dGroundAt(cx,cz),[cx,cz])
await page.evaluate(([cx,gy,cz])=>window.__town3dFlyPose(cx, gy+5, cz+10, 0, -0.1),[cx,gy,cz]); await page.waitForTimeout(1200)
await page.evaluate(()=>window.__town3dLand && window.__town3dLand(true)); await page.waitForTimeout(1600)
await page.screenshot({ path: `scripts/_shots/era_${era}_walk.png` })
console.log(era, 'gy', gy.toFixed(1), errs.length?'ERR '+errs[0]:'ok')
await browser.close()
