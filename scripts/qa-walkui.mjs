import { chromium } from 'playwright'
import fs from 'node:fs'
// 着地・歩行したときの実際の画面（CSS水彩グレード＋UI込み）を撮る。地上の景色・操作UIの現状把握。
const PORT = process.env.PORT || 4922
const SCENE = process.env.SCENE || 'kitaterao-window-3d'
const OUT = 'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots'
const browser = await chromium.launch()
// iPhone相当の縦長画面で（実機のUX確認）
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const errs = []; page.on('pageerror', e => errs.push('PE:' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CE:' + m.text().slice(0, 80)) })
await page.goto(`http://localhost:${PORT}/seasons/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.locator('.gate').click().catch(() => {})
await page.waitForTimeout(1200)
await page.evaluate(s => window.__applyScene(s), SCENE).catch(() => {})
await page.waitForTimeout(2600)
// 1) 窓辺ビュー（既定・UI込み）
await page.screenshot({ path: `${OUT}\\ui-window.png` }); console.log('ui-window')
// 2) 飛行ビュー（飛行UI込み）
await page.evaluate(() => window.__town3dFlyPose(0, 30, 50, Math.PI, -0.15)).catch(() => {}); await page.waitForTimeout(2000)
await page.screenshot({ path: `${OUT}\\ui-fly.png` }); console.log('ui-fly')
// 3) 着地・歩行ビュー（地上の景色＋歩行UI込み）
await page.evaluate(() => window.__town3dFlyPose(2, 6, -18, Math.PI, -0.05)).catch(() => {}); await page.waitForTimeout(1200)
await page.evaluate(() => window.__town3dLandToggle && window.__town3dLandToggle(true)).catch(() => {}); await page.waitForTimeout(2600)
await page.screenshot({ path: `${OUT}\\ui-walk.png` }); console.log('ui-walk')
console.log(errs.length ? 'ERR' + JSON.stringify(errs.slice(0, 3)) : 'no err')
await browser.close()
