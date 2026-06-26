import { chromium } from 'playwright'
const PORT = process.env.PORT || 4931
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {}); await page.waitForTimeout(1400)
await page.evaluate(() => window.__applyScene('kitaterao-window-3d')).catch(() => {}); await page.waitForTimeout(3000)
await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await page.waitForTimeout(500)
// 各時代エリアの中心付近へ降り、群衆（mkCrowdPerson）を接写
const eras = [['edo', 640, -46], ['sengoku', 140, -640], ['taisho', -640, -30]]
for (const [tag, cx, cz] of eras) {
  // 低空から中心を見下ろす
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x + 14, 6, z + 14, -2.36, -0.32), [cx, cz]).catch(() => {}); await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}\\ppl-${tag}-air.png` }); console.log('ppl-' + tag + '-air')
  // 地面へ降りて歩行目線
  await page.evaluate(([x, z]) => window.__town3dFlyPose(x, 4, z, -2.36, -0.05), [cx, cz]).catch(() => {}); await page.waitForTimeout(700)
  await page.evaluate(() => window.__town3dLand && window.__town3dLand(true)).catch(() => {}); await page.waitForTimeout(2400)
  await page.screenshot({ path: `${OUT}\\ppl-${tag}-walk.png` }); console.log('ppl-' + tag + '-walk')
  await page.evaluate(() => window.__town3dFly && window.__town3dFly(true)).catch(() => {}); await page.waitForTimeout(500)
}
console.log(errs.length ? 'ERR ' + errs.slice(0, 3).join(' | ') : 'no err')
await browser.close()
