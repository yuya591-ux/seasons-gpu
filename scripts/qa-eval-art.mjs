// アートディレクションQA: 3D街(窓辺/飛行/歩行)と2Dシェーダー窓辺を横断撮影。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
const errs = []
page.on('pageerror', (e) => { errs.push('PAGEERR ' + e.message); console.log('PAGE ERROR', e.message) })
page.on('console', (m) => { if (m.type() === 'error') { errs.push('CONSOLE ' + m.text()); } })
await page.goto(`http://localhost:${port}/seasons-gpu/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(700)
await page.addStyleTag({ content: '.ui{display:none !important}' })

const shot = (n) => page.screenshot({ path: `scripts/_shots/eval-art-${n}.png` })

async function applyAndWindow(scene) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2600)
}

// ===== 1) 3D街 窓辺(window+lean) =====
const town3d = [
  'kitaterao-window-3d', 'kitaterao-window-3d-night', 'kitaterao-window-3d-spring',
  'kitaterao-window-3d-autumn', 'kitaterao-window-3d-snow',
  'shishigaya-window-3d', 'shishigaya-window-3d-autumn', 'shishigaya-window-3d-snow', 'shishigaya-window-3d-spring',
]
for (const id of town3d) {
  await applyAndWindow(id)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(1300)
  await shot(`win-${id}`)
  console.log('win', id, 'done')
}

// ===== 2) 飛行(fly cruise) 数構図 =====
async function fly(scene, label, pose, zoom = 1.4) {
  await applyAndWindow(scene)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(350)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(900)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(350)
  await page.evaluate((a) => { window.__town3dCruise(false); window.__town3dZoom(a.z); window.__town3dFlyPose(a.p[0], a.p[1], a.p[2], a.p[3], a.p[4]) }, { p: pose, z: zoom })
  await page.waitForTimeout(1100)
  await shot(`fly-${label}`)
  const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
  console.log('fly', label, JSON.stringify(dbg))
}
await fly('kitaterao-window-3d', 'summer-high', [18, 46, 38, -0.5, -0.55])
await fly('kitaterao-window-3d', 'summer-low', [10, 18, 22, -0.4, -0.18])
await fly('kitaterao-window-3d-night', 'night-high', [18, 46, 38, -0.5, -0.55])
await fly('kitaterao-window-3d-snow', 'snow-cruise', [16, 34, 30, -0.5, -0.3])
await fly('shishigaya-window-3d', 'yato-cruise', [10, 30, 30, -0.3, -0.4])
await fly('kitaterao-window-3d-autumn', 'autumn-cruise', [16, 34, 30, -0.5, -0.3])

// ===== 3) 歩行(walk first-person) 数地点 =====
async function walk(scene, label, pose) {
  await applyAndWindow(scene)
  await page.evaluate(() => window.__town3dWindow(true)); await page.waitForTimeout(350)
  await page.evaluate(() => window.__town3dLean(true)); await page.waitForTimeout(800)
  await page.evaluate(() => window.__town3dFly(true)); await page.waitForTimeout(300)
  await page.evaluate((p) => window.__town3dFlyPose(p[0], p[1], p[2], p[3], p[4]), pose)
  await page.waitForTimeout(400)
  await page.evaluate(() => window.__town3dLand(true)); await page.waitForTimeout(1900)
  await shot(`walk-${label}`)
  const dbg = await page.evaluate(() => window.__town3dDbg && window.__town3dDbg())
  console.log('walk', label, JSON.stringify(dbg))
}
await walk('kitaterao-window-3d', 'summer-road', [0, 7, -8, 3.14, -0.03])
await walk('kitaterao-window-3d', 'summer-far', [0, 7, -30, 3.14, -0.03])
await walk('kitaterao-window-3d-night', 'night-road', [0, 7, -8, 3.14, -0.03])
await walk('shishigaya-window-3d', 'yato-road', [0, 7, -8, 3.14, -0.03])

// ===== 4) 2Dシェーダー窓辺 =====
const twoD = [
  'summer-rain-dusk', 'summer-rain-morning', 'summer-dusk-downtown', 'winter-snow-night-downtown',
  'summer-morning-mountains', 'summer-dusk-seaside', 'summer-clear-noon', 'shishigaya-morning-yato',
  'autumn-dusk-corner-room', 'autumn-rain-night-corner-room', 'spring-morning-corner-room', 'kitaterao-rooftop',
  'photo-window-town', 'photo-window-dusk', 'photo-window-sea', 'photo-window-night',
  'photo-window-spring', 'photo-window-autumn', 'photo-window-winter', 'photo-window-snow-night',
]
for (const id of twoD) {
  await page.evaluate((s) => window.__applyScene(s), id).catch(() => {})
  await page.waitForTimeout(2600)
  await page.addStyleTag({ content: '.ui{display:none !important}' }).catch(() => {})
  await shot(`2d-${id}`)
  console.log('2d', id, 'done')
}

console.log('--- ERRORS (' + errs.length + ') ---')
for (const e of errs.slice(0, 40)) console.log(e)
await browser.close()
console.log('eval-art done')
