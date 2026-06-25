import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:460,height:840}, deviceScaleFactor:2 })
await p.goto('http://localhost:4920/seasons/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('shishigaya-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
await p.screenshot({path:'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\yato-win.png'})
await p.evaluate(()=>window.__town3dFlyPose(0,18,30,Math.PI,-0.12)).catch(()=>{}); await p.waitForTimeout(2000)
await p.screenshot({path:'C:\\Users\\yuya.satake\\ClaudeCode\\seasons\\.qa-shots\\yato-fly.png'})
console.log('done')
await b.close()
