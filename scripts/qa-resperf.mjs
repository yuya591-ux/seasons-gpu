import { chromium } from 'playwright'
const PORT = process.env.PORT || 4876
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 } })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => window.__applyScene && window.__applyScene('summer-dusk-downtown')).catch(() => {})
await page.waitForTimeout(3500)
// 窓辺（home中心・住民多数が近い）
const a = await page.evaluate(() => window.__town3dStats())
console.log('窓辺:', JSON.stringify(a))
// 低空へ（住民を多数見る）
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dFlyPose && window.__town3dFlyPose(0, 22, 10, 0, -0.35)); await page.waitForTimeout(2500)
const b = await page.evaluate(() => window.__town3dStats())
console.log('低空home:', JSON.stringify(b))
// __town3dLoad で毎フレーム更新配列件数
const ld = await page.evaluate(() => window.__town3dLoad && window.__town3dLoad())
console.log('Load:', JSON.stringify(ld))
await browser.close()
