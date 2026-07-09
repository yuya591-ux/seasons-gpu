// スティック移動＋引いた三人称カメラ＋慣性＋バンクの確認。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const id = process.argv[2] || 'kitaterao-window-3d'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE ERROR:', m.text()) })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
await page.waitForTimeout(1800)
await page.addStyleTag({ content: '.ui{display:none !important}' })
const dbg = () => page.evaluate(() => window.__town3dDbg && window.__town3dDbg())

// 実フロー通り 窓あけ→乗り出し（枠が消える）→飛行へ＆良い俯瞰へ配置（引いた三人称の見え方）
await page.evaluate(() => window.__town3dWindow(true))
await page.waitForTimeout(1300)
await page.evaluate(() => window.__town3dLean(true))
await page.waitForTimeout(1800)
await page.evaluate(() => { window.__town3dFly(true) })
await page.waitForTimeout(400)
await page.evaluate(() => window.__town3dFlyPose(0, 34, -2, 0, -0.12))
await page.waitForTimeout(500)
console.log('配置後  :', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/stick-0-thirdperson.png' })

// スティック全倒し前進→慣性で速度が乗る＆前へ進む
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(1500)
console.log('前進中  :', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/stick-1-forward.png' })

// 旋回しながら（右見回し）前進＝バンクが出るはず
await page.evaluate(() => { window.__town3dMove(0.7, 0.7) }) // 右前へ＝横入力でバンク
await page.waitForTimeout(1200)
console.log('旋回前進:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/stick-2-bank.png' })

// 離す＝慣性で減速してホバリング
await page.evaluate(() => window.__town3dMove(0, 0))
const v0 = (await dbg()).vel
await page.waitForTimeout(1600)
const v1 = (await dbg()).vel
console.log('離した直後 vel=', v0, ' → 1.6s後 vel=', v1, '（減速してホバリング）')
await page.screenshot({ path: 'scripts/_shots/stick-3-hover.png' })

// 着地して歩く＝三人称の歩行＋スティック移動＋当たり判定
await page.evaluate(() => window.__town3dLand(true))
await page.waitForTimeout(1800)
console.log('着地後  :', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/stick-4-walk.png' })
await page.evaluate(() => window.__town3dMove(0, 1))
await page.waitForTimeout(2500)
console.log('歩行前進:', JSON.stringify(await dbg()))
await page.screenshot({ path: 'scripts/_shots/stick-5-walkfwd.png' })

await browser.close()
console.log('stickcam shots done')
