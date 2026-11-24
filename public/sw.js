// Never cache member pages, API responses, uploaded media, or credentials.
self.addEventListener('install',event=>{self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{
 if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>iStellify offline</title><body style="font:18px system-ui;padding:3rem;background:#13293D;color:white"><h1>You’re offline</h1><p>Reconnect to open your private church space.</p><button onclick="location.reload()">Try again</button></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})));
});
