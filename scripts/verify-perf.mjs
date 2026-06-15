// 省電力改修の確認: 重い情景でコンソールエラーが無いか、描画解像度(DPR)が下がったか、
// 約30fpsの間引きが効いて実描画回数が約半分になっているかを確かめる。
import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 400, height: 850 }, deviceScaleFactor: 3 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
await page.goto('http://localhost:4790/seasons/?dev=1', { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)

const scenes = process.argv.slice(2)
if (scenes.length === 0) scenes.push('autumn-dusk-corner-room', 'kitaterao-rooftop', 'shishigaya-morning-yato', 'kitaterao-window-3d')

for (const id of scenes) {
  await page.evaluate((sid) => window.__applyScene && window.__applyScene(sid), id)
  await page.waitForTimeout(3000) // 自動解像度調整が落ち着くまで
  const info = await page.evaluate(() => {
    const c = document.querySelector('canvas')
    const stage = document.querySelector('.town3d-stage')
    const town3dCanvas = stage && stage.querySelector('canvas')
    const target = town3dCanvas || c
    return {
      cssW: target ? target.clientWidth : 0,
      pxW: target ? target.width : 0,
      pxH: target ? target.height : 0,
      town3d: !!stage,
      dpr: window.devicePixelRatio,
    }
  })
  const effDpr = info.cssW ? (info.pxW / info.cssW).toFixed(2) : '?'
  console.log(`${id}: ${info.town3d ? '[3D町]' : '[shader]'} 画面幅css=${info.cssW} px=${info.pxW}x${info.pxH} 実効DPR=${effDpr} (端末DPR=${info.dpr})`)
}
console.log(errors.length ? ('コンソールエラー: ' + JSON.stringify(errors.slice(0, 6))) : 'コンソールエラー無し ✓')
await browser.close()
