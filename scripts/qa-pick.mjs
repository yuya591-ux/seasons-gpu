import { chromium } from 'playwright'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:440,height:800} })
await p.goto('http://localhost:4920/seasons-gpu/?dev=1',{waitUntil:'domcontentloaded',timeout:60000})
await p.locator('.gate').click().catch(()=>{}); await p.waitForTimeout(1200)
await p.evaluate(()=>window.__applyScene('kitaterao-window-3d')).catch(()=>{}); await p.waitForTimeout(2800)
// downtownの灰色面付近を上からレイキャストして当たるメッシュの色/頂点数を見る
for(const [x,z] of [[-110,-54],[-115,-56],[-105,-50],[-118,-56]]){
  const r = await p.evaluate(([X,Z])=>{ const rc=new (window.__THREE?window.__THREE.Raycaster:Object)(); return window.__town3dPick?window.__town3dPick(X,Z):window.__town3dRayGround(X,Z) },[x,z])
  console.log(x+','+z, JSON.stringify(r))
}
await b.close()
