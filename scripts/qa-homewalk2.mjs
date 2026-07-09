import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:520,height:480}, deviceScaleFactor:2 })
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2600)
// 街なかの開けた所(駅前/公園付近)へ低く降りて着地→歩行の主観(page.screenshot=グレード込み)
await p.evaluate(()=>window.__town3dFlyPose(16,7,-20,Math.PI,-0.02)).catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__town3dLandToggle&&window.__town3dLandToggle(true)).catch(()=>{}); await p.waitForTimeout(2500)
await p.screenshot({path:'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\homewalk-real.png'})
console.log('done')
await b.close()
