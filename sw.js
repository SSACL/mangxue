const CACHE='mangxue-v46';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png','icons/badge-96.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('mangxue-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET') return;
  const u=new URL(r.url);
  const font=u.host==='fonts.googleapis.com'||u.host==='fonts.gstatic.com';
  if(u.origin!==location.origin&&!font) return;
  e.respondWith(caches.open(CACHE).then(async c=>{
    const key=(r.mode==='navigate')?'index.html':r;
    const hit=await c.match(key,{ignoreSearch:r.mode==='navigate'});
    const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')) c.put(key,res.clone());return res;}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}
    const res=await net; return res||new Response('オフラインです',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});

/* notifications sent by the user's own sender (Cloudflare) */
function idbGet(key){return new Promise(res=>{let r;try{r=indexedDB.open('mangxue',1);}catch(_){res(null);return;}
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{try{const g=r.result.transaction('kv').objectStore('kv').get(key);g.onsuccess=()=>res(g.result||null);g.onerror=()=>res(null);}catch(_){res(null);}};
  r.onerror=()=>res(null);});}
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(_){d={title:'芒学 mángxué',body:e.data?e.data.text():''};}
  e.waitUntil((async()=>{
    let show=d, quiet=false;
    // a commute notice made before the trip was worked out again (次の電車に乗る) shows the current plan instead, quietly
    if(d.rid&&String(d.rid).indexOf('cm:')===0&&d.tag){
      const notes=await idbGet('__cmnotes'), n=notes&&notes[d.tag];
      if(n&&n.rid&&n.rid!==d.rid){show=Object.assign({},d,{title:'（組み直し後）'+n.title,body:n.body,rid:n.rid,actions:n.actions||d.actions});quiet=true;}
      else if(notes&&!n&&(notes.__days||[]).includes(d.ds)){show=Object.assign({},d,{title:'通勤の予定は組み直し済みです',body:'アプリで最新の予定を確かめてください',actions:[]});quiet=true;}
    }
    return self.registration.showNotification(show.title||'芒学 mángxué',{body:show.body||'',tag:show.tag||undefined,lang:'ja',icon:'icons/icon-192.png',badge:'icons/badge-96.png',data:show,actions:(show.actions||[]).slice(0,2),silent:quiet});
  })());
});
// ○ / × on the notification: keep the answer on this device; the app applies it next time it opens
function saveAnswer(a){return new Promise(res=>{let r;try{r=indexedDB.open('mangxue',1);}catch(_){res();return;}
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{try{const tx=r.result.transaction('kv','readwrite'),st=tx.objectStore('kv'),g=st.get('__answers');g.onsuccess=()=>{const list=g.result||[];list.push(a);st.put(list,'__answers');};tx.oncomplete=()=>res();tx.onerror=()=>res();}catch(_){res();}};
  r.onerror=()=>res();});}
self.addEventListener('notificationclick',e=>{
  const d=e.notification.data||{};e.notification.close();
  // 次の電車に乗る: keep the request, then bring the app up so it works out the rest of the trip and re-sends the notices
  if(e.action==='next'&&d.ds&&d.rid){
    e.waitUntil(saveAnswer({ds:d.ds,cm:d.rid,t:Date.now()}).then(()=>self.clients.matchAll({type:'window',includeUncontrolled:true})).then(ws=>{
      if(ws.length){ws.forEach(w=>w.postMessage({type:'answers'}));return ws[0].focus?ws[0].focus():null;}
      return self.clients.openWindow(new URL('./#home',self.registration.scope).href);}));
    return;
  }
  if((e.action==='ok'||e.action==='ng')&&d.ds&&d.rid){
    e.waitUntil(saveAnswer({ds:d.ds,rid:d.rid,v:e.action==='ok'?1:0,t:Date.now()}).then(()=>self.clients.matchAll({type:'window'})).then(ws=>ws.forEach(w=>w.postMessage({type:'answers'}))));
    return;
  }
  const url=new URL(d.url||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if('focus' in w) return w.focus().then(c=>(c&&c.navigate)?c.navigate(url):c);}
    return self.clients.openWindow(url);}));
});
