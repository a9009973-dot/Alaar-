/* Keeps the app's localStorage state recoverable through IndexedDB. */
(function(){
  'use strict';
  if (!('indexedDB' in window) || !('localStorage' in window)) return;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function(){}); } catch(e) {}
  var DB='watar-pwa-storage', STORE='snapshots', KEY='localStorage';
  var dbReady=new Promise(function(resolve){
    var req; try { req=indexedDB.open(DB,1); } catch(e) { resolve(null); return; }
    req.onupgradeneeded=function(){ if(!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess=function(){resolve(req.result)}; req.onerror=req.onblocked=function(){resolve(null)};
  });
  function read(db){return new Promise(function(resolve){try{var r=db.transaction(STORE,'readonly').objectStore(STORE).get(KEY);r.onsuccess=function(){resolve(r.result||null)};r.onerror=function(){resolve(null)}}catch(e){resolve(null)}})}
  function write(db,value){try{db.transaction(STORE,'readwrite').objectStore(STORE).put(value,KEY)}catch(e){}}
  var nativeSet=Storage.prototype.setItem, ready=false, queued=[], timer=0;
  // Avoid persisting a transient empty app state before recovery finishes.
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&!ready){queued.push([String(k),String(v)]);return}return nativeSet.call(this,k,v)};
  function snapshot(){dbReady.then(function(db){if(!db)return;var data={};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);data[k]=localStorage.getItem(k)}}catch(e){}if(Object.prototype.hasOwnProperty.call(data,'mp2'))write(db,data)})}
  function schedule(){clearTimeout(timer);timer=setTimeout(snapshot,350)}
  dbReady.then(function(db){
    if(!db){ready=true;queued.forEach(function(x){nativeSet.call(localStorage,x[0],x[1])});return}
    read(db).then(function(saved){
      var hasApp=false;try{hasApp=localStorage.getItem('mp2')!==null}catch(e){}
      if(saved&&!hasApp){try{Object.keys(saved).forEach(function(k){nativeSet.call(localStorage,k,saved[k])})}catch(e){};
        try{if(!sessionStorage.getItem('watar-pwa-restored')){sessionStorage.setItem('watar-pwa-restored','1');location.reload();return}}catch(e){}
      }
      ready=true;queued.forEach(function(x){nativeSet.call(localStorage,x[0],x[1])});queued=[];snapshot();
    });
  });
  window.addEventListener('pagehide',snapshot);
  window.addEventListener('storage',schedule);
  var originalClear=Storage.prototype.clear;
  Storage.prototype.clear=function(){var isLocal=this===localStorage;var ret=originalClear.call(this);if(isLocal)schedule();return ret};
  var originalRemove=Storage.prototype.removeItem;
  Storage.prototype.removeItem=function(k){var isLocal=this===localStorage;var ret=originalRemove.call(this,k);if(isLocal)schedule();return ret};
  // Capture app writes (which use localStorage.setItem) without modifying its code.
  var wrappedSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){var isLocal=this===localStorage;var ret=wrappedSet.call(this,k,v);if(isLocal&&ready)schedule();return ret};
})();
