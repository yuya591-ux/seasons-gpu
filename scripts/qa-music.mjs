// 生成BGMの下地が「場面」に応じて変わるか（音量/音色/和音）を数値で確認。
// 室内→飛行→江戸の近く→海上→戦国の近く で bedGain/bedCut/bedVoice が変化するはず。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => window.__audio && window.__audio.start && window.__audio.start())
await page.waitForTimeout(300)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2400)
const dbg = () => page.evaluate(() => window.__audio.getDebug())
const settle = (ms = 2600) => page.waitForTimeout(ms)

console.log('① 起動直後(室内):', JSON.stringify(await dbg()))
await page.evaluate(() => { window.__town3dFly(true) }); await settle()
await page.evaluate(() => window.__town3dFlyPose(120, 40, -20, Math.PI / 2, -0.15)); await settle()
console.log('② 飛行(home上空):', JSON.stringify(await dbg()))
await page.evaluate(() => window.__town3dFlyPose(440, 44, -46, Math.PI / 2, -0.12)); await settle(3200)
console.log('③ 江戸の近く:', JSON.stringify(await dbg()))
await page.evaluate(() => window.__town3dFlyPose(250, 46, -180, Math.PI / 2, -0.05)); await settle(3200)
console.log('④ 海上(渡りの最中):', JSON.stringify(await dbg()))
await page.evaluate(() => window.__town3dFlyPose(120, 40, -430, 0.2, -0.1)); await settle(3200)
console.log('⑤ 戦国の近く(山):', JSON.stringify(await dbg()))
await browser.close()
