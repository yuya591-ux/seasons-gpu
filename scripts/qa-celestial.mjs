// 天上界グレードの効きを昼/朝の雲海で確認。明るい情景でも雲海に出ると金桃のmagic hourになり、下界の街と差別化されるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '5095'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 600, height: 460 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
await page.addStyleTag({ content: '.ui{display:none !important}' })
async function flyShot(scene, label) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2600)
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(250)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(600)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(300)
  await page.evaluate(() => { window.__town3dCruise(false) })
  // 街の上(低空)＝下界
  await page.evaluate(() => window.__town3dFlyPose(0, 40, -40, 0, 0.02)); await page.waitForTimeout(1600)
  await page.screenshot({ path: `scripts/_shots/cel-${label}-town.png` })
  // 雲海の上＝天上界
  await page.evaluate(() => window.__town3dFlyPose(-20, 112, -300, 0, -0.04)); await page.waitForTimeout(1800)
  await page.screenshot({ path: `scripts/_shots/cel-${label}-cloud.png` })
  console.log(label, 'done')
}
await flyShot('summer-morning-corner-room', 'morning')
await browser.close()
console.log('check done')
