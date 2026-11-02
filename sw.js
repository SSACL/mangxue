const CACHE='mangxue-v16';
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
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(_){d={title:'芒学 mángxué',body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'芒学 mángxué',{body:d.body||'',tag:d.tag||undefined,lang:'ja',icon:'icons/icon-192.png',badge:'icons/badge-96.png',data:d,actions:(d.actions||[]).slice(0,2)}));
});
// ○ / × on the notification: keep the answer on this device; the app applies it next time it opens
function saveAnswer(a){return new Promise(res=>{let r;try{r=indexedDB.open('mangxue',1);}catch(_){res();return;}
  r.onupgradeneeded=()=>r.result.createObjectStore('kv');
  r.onsuccess=()=>{try{const tx=r.result.transaction('kv','readwrite'),st=tx.objectStore('kv'),g=st.get('__answers');g.onsuccess=()=>{const list=g.result||[];list.push(a);st.put(list,'__answers');};tx.oncomplete=()=>res();tx.onerror=()=>res();}catch(_){res();}};
  r.onerror=()=>res();});}
self.addEventListener('notificationclick',e=>{
  const d=e.notification.data||{};e.notification.close();
  if((e.action==='ok'||e.action==='ng')&&d.ds&&d.rid){
    e.waitUntil(saveAnswer({ds:d.ds,rid:d.rid,v:e.action==='ok'?1:0,t:Date.now()}).then(()=>self.clients.matchAll({type:'window'})).then(ws=>ws.forEach(w=>w.postMessage({type:'answers'}))));
    return;
  }
  const url=new URL(d.url||'./',self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{
    for(const w of ws){if('focus' in w) return w.focus().then(c=>(c&&c.navigate)?c.navigate(url):c);}
    return self.clients.openWindow(url);}));
});
