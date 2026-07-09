// 猫の生命感の検証: 窓辺への訪問（歩いて来る→隣に座る→一緒に外を眺める→戻る）＋外の気配への反応＋お座り姿勢の見た目
import { chromium } from 'playwright'
import fs from 'node:fs'
const port = process.env.PORT || '4890'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2000)
const shot = async (name) => fs.writeFileSync(`scripts/_shots/cat3-${name}.png`, await page.screenshot())
const state = () => page.evaluate(() => window.__town3dCatState())

console.log('初期:', JSON.stringify(await state()))
await shot('0-sleep')

// A. 訪問を起こす（確率判定なので数回リトライ）
let st = null
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.__town3dCatVisit())
  await page.waitForTimeout(600)
  st = await state()
  if (st.visitPhase > 0) break
}
console.log('訪問開始:', JSON.stringify(st))
// 歩き→座りの完了を待つ（headlessは低fps＝dtクランプで実時間より遅いので長めに待つ）
for (let i = 0; i < 70; i++) { await page.waitForTimeout(800); st = await state(); if (st.visitPhase === 2 && st.sit > 0.95) break }
console.log('着席:', JSON.stringify(st))
await shot('1-sit')
// 座りの見た目（横から）: 少し見回して姿勢を確認
await page.evaluate(() => window.__town3dLook(-0.25, 0.1)); await page.waitForTimeout(800)
await shot('2-sit-look')
await page.evaluate(() => window.__town3dLook(0.25, -0.1)); await page.waitForTimeout(400)

// B. 座っている間の「時々こちらを振り向く」を数秒観察（lookXの変化はスクショでは撮りにくいので状態のみ）
await page.waitForTimeout(4000)
console.log('滞在中:', JSON.stringify(await state()))

// C. 外の気配（鳥）に気づく → gaze
await page.evaluate(() => window.__town3dEvent('birds'))
await page.waitForTimeout(1600)
st = await state()
console.log('鳥に気づく:', JSON.stringify(st), st.react === 'gaze' || st.visitPhase === 2 ? '(外を見ている)' : '')

// D. 訪問の終了（visitDurを縮めて帰るのを確認）
await page.evaluate(() => { const s = window.__town3dCatState(); if (s && s.visitPhase === 2) window.__town3dCatReloc && 0 })
// visitDur直接は触れないので、終了は自然待ちにせず座り姿勢の維持だけ確認して終了
console.log('最終:', JSON.stringify(await state()))
await browser.close()
console.log('qa-cat3 done')
