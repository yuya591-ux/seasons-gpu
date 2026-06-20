// 北の海を渡って戦国の山城が霞から現れるか確認。北(-z)へ近づきながら数カット。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(400)
await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(500)
await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(800)
await page.evaluate(() => { window.__town3dCruise(false) }); await page.waitForTimeout(200)
const shoot = async (z, y, pit, name) => { await page.evaluate(([z, y, p]) => window.__town3dFlyPose(36, y, z, 0, p), [z, y, pit]); await page.waitForTimeout(800); await page.screenshot({ path: `scripts/_shots/${name}.png` }) }
await shoot(-271, 44, -0.04, 'sengoku-far')   // dSen≈215
await shoot(-346, 46, -0.10, 'sengoku-mid')   // dSen≈140
await shoot(-421, 40, -0.13, 'sengoku-near')  // dSen≈65
await shoot(-431, 56, -0.26, 'sengoku-top')
await page.evaluate(() => window.__town3dFlyPose(70, 16, -430, -1.1, -0.08)); await page.waitForTimeout(800); await page.screenshot({ path: 'scripts/_shots/sengoku-slope.png' }) // 山裾の城下を低空で（接地確認）
console.log('sengoku shots done')
await browser.close()
