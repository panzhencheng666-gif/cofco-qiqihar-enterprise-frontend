/* Shared by the workbench and overview entry points. Keep both copies identical.
 * Loaded before application modules so cached fetch references also use recovery.
 * Authentication policy remains server-owned; failed writes are never replayed.
 */
(() => {
  'use strict';
  if (window.cofcoSessionRecovery) return;
  const originalFetch = window.fetch.bind(window);
  const streams = new Set();
  let expired = false;
  let dialog;
  let notice;
  let checking = false;
  let focusBefore;
  const protectedUrl = (input) => {
    try {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      return url.origin === location.origin && url.pathname.startsWith('/api/v1/') &&
        !/^\/api\/v1\/(?:identity\/(?:registration-entry|phone)|session\/(?:login|logout))(?:\/|$)/.test(url.pathname);
    } catch { return false; }
  };
  function parentRecovery() {
    try { return (window.parent !== window && window.parent.location.origin === location.origin && window.parent.cofcoSessionRecovery) || null; }
    catch { return null; }
  }
  function isExpired() { return expired || Boolean(parentRecovery()?.isExpired()); }
  function failure() {
    return new Response(JSON.stringify({code:'AUTHENTICATION_REQUIRED',message:'登录已失效，请重新登录。'}),
      {status:401,headers:{'Content-Type':'application/json'}});
  }
  function pause() {
    expired = true;
    for (const stream of streams) stream.close();
    streams.clear();
  }
  function expire() {
    pause();
    const parent = parentRecovery();
    if (parent) { parent.expire(); return; }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', show, {once:true});
    } else show();
  }
  function button(text, action) {
    const el = document.createElement('button'); el.type='button'; el.textContent=text;
    el.style.cssText='padding:10px 14px;border:1px solid #bac9dd;border-radius:6px;background:#fff;color:#173554;font:inherit;cursor:pointer';
    el.addEventListener('click',action); return el;
  }
  function hide() { dialog.close(); notice.hidden=false; if (focusBefore?.isConnected) focusBefore.focus(); }
  async function recover() {
    if (checking) return;
    checking=true;
    const status=dialog.querySelector('[role="status"]');
    status.textContent='正在确认登录状态…';
    try {
      const response=await originalFetch('/api/v1/session/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (response.ok) { location.reload(); return; }
      status.textContent=response.status===401 ? '尚未恢复登录。请先在新标签页完成登录，再点击恢复。' : '暂时无法确认登录状态，请稍后再试。';
    } catch { status.textContent='网络暂时不可用，当前页面已保留，请稍后再试。'; }
    finally { checking=false; }
  }
  function show() {
    if (dialog) { if (!dialog.open && notice.hidden) dialog.showModal(); return; }
    focusBefore=document.activeElement;
    dialog=document.createElement('dialog');
    dialog.setAttribute('aria-labelledby','cofco-session-title');
    dialog.setAttribute('aria-describedby','cofco-session-description');
    dialog.style.cssText='box-sizing:border-box;width:min(540px,calc(100vw - 32px));padding:28px;border:1px solid #cbd6e4;border-radius:12px;background:#fff;color:#19334f;box-shadow:0 20px 80px #102b4b55;font:15px/1.7 system-ui,sans-serif;z-index:2147483647';
    const title=document.createElement('h2');title.id='cofco-session-title';title.textContent='登录已失效';title.style.cssText='font-size:22px;margin:0 0 12px';
    const description=document.createElement('p'); description.id='cofco-session-description';
    description.textContent='当前登录已失效，业务数据读取和提交已暂停。请重新登录后恢复当前页面。';
    const draft=document.createElement('p');draft.textContent='当前页面暂时保留。恢复时会刷新页面，请先复制尚未保存的填写内容。';draft.style.color='#62738b';
    const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:10px;margin-top:20px';
    const login=document.createElement('a');login.href='/api/v1/session/login';login.target='_blank';login.rel='noopener';login.textContent='重新登录（新标签页）';
    login.style.cssText='padding:10px 14px;border-radius:6px;background:#2262b6;color:white;text-decoration:none';
    actions.append(login,button('已登录，恢复当前页面',recover),button('保留当前页面',hide));
    const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='margin:12px 0 0;color:#9d512b';
    dialog.append(title,description,draft,actions,status);
    notice=button('登录已失效 · 点击恢复',()=>{notice.hidden=true;focusBefore=document.activeElement;dialog.showModal();});
    notice.style.cssText+=';position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#fff4df;color:#7a4b12;box-shadow:0 3px 18px #0003';notice.hidden=true;
    dialog.addEventListener('cancel',e=>{e.preventDefault();hide();});
    document.body.append(dialog,notice);dialog.showModal();
  }
  window.cofcoSessionRecovery={expire,isExpired};
  window.fetch=async (input,options) => {
    const scoped=protectedUrl(input);
    if (scoped && isExpired()) return failure();
    const response=await originalFetch(input,options);
    if (scoped && response.status===401) expire();
    return response;
  };
  // EventSource hides HTTP status; confirm authentication only when a stream fails.
  // Do not turn a network error or forbidden operation into a login-expiry claim.
  if (window.EventSource) {
    const NativeEventSource=window.EventSource;
    let probe;
    window.EventSource=class extends NativeEventSource {
      constructor(url,options) {
        super(url,options);
        if (!protectedUrl(url)) return;
        if (isExpired()) { this.close(); return; }
        streams.add(this);
        this.addEventListener('error',()=>{
          if (isExpired()) { this.close(); return; }
          if (!probe) probe=originalFetch('/api/v1/session/me',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000)})
            .then(r=>{if(r.status===401) expire();}).catch(()=>{}).finally(()=>{probe=null;});
        });
      }
      close() { streams.delete(this);super.close(); }
    };
  }
})();
