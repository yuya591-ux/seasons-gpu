// 夜の街の虫の音: コオロギ＋鈴虫の2レイヤーがエラーなく鳴り、室内は防音・空で晴れるか。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
let errs = 0
page.on('pageerror', (e) => { errs++; console.log('PAGE ERROR', e.message) })
page.on('console', (m) => { if (m.type() === 'error') { errs++; console.log('CONSOLE ERROR', m.text()) } })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(400)
await page.evaluate(() => window.__audio && window.__audio.start && window.__audio.start())
await page.evaluate(() => window.__applyScene('kitaterao-window-3d-night'))
await page.waitForTimeout(2600)
// 窓を閉→開して防音（音量/こもり）が切り替わるか、内部状態は getDebug にないが、エラーなしと層数を確認
const info = await page.evaluate(() => ({ dbg: window.__audio.getDebug() }))
console.log('夜・室内:', JSON.stringify(info))
await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(1200)
console.log('窓を開けた（防音解除）→ エラー無し確認のみ')
await page.waitForTimeout(800)
console.log(errs === 0 ? 'NIGHT AUDIO OK (no errors)' : `NIGHT AUDIO FAIL (${errs})`)
await browser.close()
