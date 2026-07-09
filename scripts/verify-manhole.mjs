// マンホール追加の検証。console.error と pageerror を両方捕捉し（town3dはmount失敗を
// console.error+フォールバックするため pageerror だけだと見逃す）、town3dが生きているか
// (__town3dSetView の存在)を確認、路面を見下ろしてマンホールが写るか撮影する。
import { chromium } from 'playwright'
const port = process.env.PORT || '4855'
const id = 'kitaterao-window-3d'
const errors = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(2000)
const town3dActive = await page.evaluate(() => !!window.__town3dSetView)
await page.addStyleTag({ content: '.ui{display:none !important}' })
// 乗り出して路面を見下ろす（マンホールは手前 z=3..-67 の路面上）
await page.evaluate(() => window.__town3dLean && window.__town3dLean(true))
await page.waitForTimeout(2000)
await page.evaluate(() => window.__town3dSetView && window.__town3dSetView(0, -0.7))
await page.waitForTimeout(1100)
await page.screenshot({ path: 'scripts/_shots/manhole-down.png' })
console.log('town3dActive =', town3dActive)
console.log('errors =', errors.length)
for (const e of errors) console.log('  ', e)
await browser.close()
