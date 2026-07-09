// 省電力調査: 窓辺idleの実描画間隔(16fps化の確認)・CSS合成層の実数・canvas属性・操作時の復帰を実測
import { chromium } from 'playwright'
const port = process.env.PORT || '4917'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE EXCEPTION:', e.message))
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.evaluate(() => window.__applyScene && window.__applyScene('kitaterao-window-3d'))
await page.waitForTimeout(2200)

// canvas属性（antialias/powerPreference/alpha）
const attrs = await page.evaluate(() => {
  const c = document.querySelector('.town3d-stage canvas')
  const gl = c && (c.getContext('webgl2') || c.getContext('webgl'))
  return gl ? gl.getContextAttributes() : null
})
console.log('canvas属性:', JSON.stringify(attrs))

// CSS全画面合成層の実数（town3d上に常時重なる層）
const layers = await page.evaluate(() => {
  const sel = ['.town3d-atmo', '.town3d-wash', '.town3d-paper', '.town3d-paper2', '.town3d-bleed']
  return sel.map((s) => {
    const el = document.querySelector(s)
    if (!el) return `${s}: なし`
    const cs = getComputedStyle(el)
    return `${s}: display=${cs.display} blend=${cs.mixBlendMode} opacity=${cs.opacity}`
  })
})
console.log('CSS層:', JSON.stringify(layers, null, 1))

// 窓辺で6秒無操作 → idle間引きの実描画間隔（期待: 約0.062s=16fps）
await page.waitForTimeout(6000)
const idle = []
for (let i = 0; i < 6; i++) { await page.waitForTimeout(400); idle.push(await page.evaluate(() => window.__town3dStats().ddt)) }
console.log('idle時の描画間隔(s):', idle.join(', '))

// 操作すると即復帰するか（期待: 約0.033s=30fps）
await page.evaluate(() => window.__town3dLook(0.08, 0))
const act = []
for (let i = 0; i < 6; i++) { await page.waitForTimeout(300); act.push(await page.evaluate(() => { window.__town3dLook(0.02, 0); return window.__town3dStats().ddt })) }
console.log('操作時の描画間隔(s):', act.join(', '))

// 現在の解像度倍率と自動品質の状態
const st = await page.evaluate(() => window.__town3dStats())
console.log('stats:', JSON.stringify(st))
await browser.close()
console.log('qa-power1 done')
