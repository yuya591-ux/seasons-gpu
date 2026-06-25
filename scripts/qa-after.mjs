import { chromium } from 'playwright'
const PORT = process.env.PORT || 4877
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 760, height: 720 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => errs.push('PE:' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errs.push('CE:' + m.text()) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1&fest=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(700)
await page.evaluate(() => window.__town3dCruise(false)); await page.waitForTimeout(300)
// 祭り会場・群衆の俯瞰
const views = [
  ['fes_plaza', 0, 7, 20, 0, -0.22],   // 目の前の広場の盆踊り
  ['fes_yamayuri', 36, 9, -22, 0, -0.22], // やまゆりのサマフェス（見物客）
  ['crowd_station', 34, 6, -30, 0, -0.26], // 駅前の人だまり
]
for (const [name, x, y, z, yaw, pitch] of views) {
  await page.evaluate(([x, y, z, yaw, pitch]) => window.__town3dFlyPose(x, y, z, yaw, pitch), [x, y, z, yaw, pitch])
  await page.waitForTimeout(2400)
  await page.screenshot({ path: `scripts/_shots/aft_${name}.png` })
  console.log('view', name)
}
// peep接写（カメラを開けた空へ向け、settle後にpeepを視線上へ）
await page.evaluate(() => window.__town3dFlyPose(0, 9, 26, 0, -0.05)); await page.waitForTimeout(2400)
for (const i of [0, 5, 10]) {
  await page.evaluate((i) => window.__town3dPeepFront(i, 4.5, 0.6), i)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `scripts/_shots/aft_peepf_${i}.png` })
  console.log('peepf', i)
}
console.log(errs.length ? 'ERR ' + JSON.stringify(errs.slice(0, 5)) : 'no errors')
await browser.close()
