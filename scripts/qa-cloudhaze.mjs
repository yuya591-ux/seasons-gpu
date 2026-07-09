// 雲を抜けるときの白いかすみの確認。最寄りの雲の位置へ飛ばして近づき具合で白むか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1800)
await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(400)
await page.addStyleTag({ content: '.ui{display:none !important}' })

const clouds = await page.evaluate(() => window.__town3dClouds())
// 箱(z>-86)内にある手前の雲を選ぶ
const c = clouds.filter((p) => p[2] > -84).sort((a, b) => b[2] - a[2])[0] || clouds[0]
console.log('狙う雲:', JSON.stringify(c))

// 雲の手前(少し離れて)＝うっすら
await page.evaluate((c) => window.__town3dFlyPose(c[0], c[1], c[2] + 13, 0, 0), c)
await page.waitForTimeout(500)
await page.screenshot({ path: 'scripts/_shots/cloud-0-near.png' })
// 雲の中心＝白くかすむ
await page.evaluate((c) => window.__town3dFlyPose(c[0], c[1], c[2] + 1, 0, 0), c)
await page.waitForTimeout(600)
const hz = await page.evaluate(() => getComputedStyle(document.querySelector('.town3d-cloudhaze')).opacity)
console.log('雲中心の cloudhaze opacity =', hz)
await page.screenshot({ path: 'scripts/_shots/cloud-1-inside.png' })
// 抜けた後＝晴れる
await page.evaluate((c) => window.__town3dFlyPose(c[0], c[1], c[2] - 40, 0, 0), c)
await page.waitForTimeout(600)
const hz2 = await page.evaluate(() => getComputedStyle(document.querySelector('.town3d-cloudhaze')).opacity)
console.log('抜けた後 opacity =', hz2)
await page.screenshot({ path: 'scripts/_shots/cloud-2-clear.png' })

await browser.close()
console.log('cloudhaze shots done')
