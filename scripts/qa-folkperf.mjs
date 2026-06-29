import { chromium } from 'playwright'
const PORT = process.env.PORT || 4896
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 }) // iPhone風の縦窓
page.on('pageerror', e => console.log('PAGEERR', e.message))
const stats = async () => { await page.waitForTimeout(900); return page.evaluate(() => window.__town3dStats && window.__town3dStats()) }

// ① 祭り全開（?fest=1で4会場すべて＝最悪ケース）の窓辺ビュー（盆踊りが窓前）
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset')); await page.waitForTimeout(2600)
console.log('祭り全開・窓辺   :', JSON.stringify(await stats()))
const fc = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount()); console.log('  festDancers =', fc)

// ② 祭り無し（同シーン・fest無し）＝ベースライン
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset')); await page.waitForTimeout(2600)
console.log('祭り無し・窓辺   :', JSON.stringify(await stats()))
const fc2 = await page.evaluate(() => window.__town3dFolkCount && window.__town3dFolkCount()); console.log('  festDancers =', fc2)

// ③ 祭り全開で実際に広場へ降りて散歩目線（最も人が密集して見える）
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-sunset')) // 念のため
await page.waitForTimeout(1500)

// ④ 雲海（夜）に滞在
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(()=>{})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-rain-night')); await page.waitForTimeout(2600)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(600)
await page.evaluate(() => window.__town3dFlyPose(20, 100, -260, -0.2, -0.05)); await page.waitForTimeout(600)
console.log('雲海・夜飛行     :', JSON.stringify(await stats()))
await browser.close()
