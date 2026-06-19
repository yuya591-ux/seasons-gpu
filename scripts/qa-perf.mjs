// 性能点検: 描画コール/三角形/オブジェクト数とFPSを各シーン・各視点で測る。
import { chromium } from 'playwright'
const port = process.env.PORT || '4801'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 440, height: 900 }, deviceScaleFactor: 2 })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto(`http://localhost:${port}/seasons/?dev=1`, { waitUntil: 'networkidle' })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(600)
async function measFps() {
  return await page.evaluate(() => new Promise((res) => {
    let n = 0, t0 = performance.now()
    function tick() { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else res(Math.round(n / ((performance.now() - t0) / 1000))) }
    requestAnimationFrame(tick)
  }))
}
for (const scene of ['kitaterao-window-3d', 'kitaterao-window-3d-night', 'shishigaya-window-3d']) {
  await page.evaluate((s) => window.__applyScene(s), scene)
  await page.waitForTimeout(2600)
  // 窓辺
  let st = await page.evaluate(() => window.__town3dStats && window.__town3dStats())
  let fps = await measFps()
  console.log(`${scene} 窓辺: calls=${st.calls} tris=${st.tris} objs=${st.objs} pr=${st.pr} fps=${fps}`)
  // 飛行・俯瞰
  await page.evaluate(() => { window.__town3dWindow(true) }); await page.waitForTimeout(800)
  await page.evaluate(() => { window.__town3dLean(true) }); await page.waitForTimeout(900)
  await page.evaluate(() => { window.__town3dFly(true) }); await page.waitForTimeout(400)
  await page.evaluate(() => { window.__town3dCruise(false); window.__town3dZoom(1.5); window.__town3dFlyPose(0, 70, -10, 0, -0.5) })
  await page.waitForTimeout(900)
  st = await page.evaluate(() => window.__town3dStats && window.__town3dStats())
  fps = await measFps()
  console.log(`${scene} 高空俯瞰: calls=${st.calls} tris=${st.tris} objs=${st.objs} fps=${fps}`)
}
await browser.close()
console.log('perf done')
