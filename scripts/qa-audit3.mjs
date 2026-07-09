// 町並みの配置違反監査(2026-07): 家に食い込む木（取り下げ数）・道/線路上の建物・除外地点の見た目確認
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
const audit = await page.evaluate(() => window.__town3dTownAudit())
console.log('監査:', JSON.stringify(audit))

// 除外地点の見た目確認（家の屋根から木が生えていないこと）
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dCruise(false))
await page.addStyleTag({ content: '.ui{display:none !important}' })
const save = (dataUrl, name) => { if (!dataUrl) { console.log('SHOT失敗:', name); return } fs.writeFileSync(`scripts/_shots/audit-${name}.png`, Buffer.from(dataUrl.split(',')[1], 'base64')) }
for (let i = 0; i < Math.min(3, (audit.buriedSamples || []).length); i++) {
  const [x, z] = audit.buriedSamples[i]
  await page.evaluate(([a, b]) => window.__town3dFlyPose(a + 6, 26, b + 8, 0, 0), [x, z])
  await page.waitForTimeout(600)
  const gy = await page.evaluate(([a, b]) => window.__town3dGroundAt(a, b), [x, z])
  const du = await page.evaluate(([a, b, g]) => window.__town3dShotAt(a + 7, g + 6, b + 9, a, g + 1.5, b, 55), [x, z, gy])
  save(du, `spot${i}-${x}_${z}`)
}
await browser.close()
console.log('qa-audit3 done')
