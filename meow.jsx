const { useState, useEffect, useRef, useCallback } = React;

const API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "stepfun/step-3.5-flash:free";
const MODEL_FALLBACKS = [
  DEFAULT_MODEL,
  "stepfun/step-3.5-flash:free",
  "qwen/qwen3-coder:free",
];
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3-32b";
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// ─── Persistent Storage ───
async function loadVal(key) {
  try { const r = await window.storage.get(key); return r?.value || ""; } catch { return ""; }
}
async function saveVal(key, val) {
  try { await window.storage.set(key, val); } catch {}
}
async function loadChat() {
  try { const r = await window.storage.get("meow-chat"); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveChat(msgs) {
  try { await window.storage.set("meow-chat", JSON.stringify(msgs.slice(-40))); } catch {}
}
async function loadApiKey() {
  try {
    if (window.storage?.get) {
      const r = await window.storage.get("openrouter-api-key");
      if (r?.value) return String(r.value).trim();
    }
  } catch {}
  try { return (window.localStorage.getItem("openrouter-api-key") || "").trim(); } catch { return ""; }
}
async function saveApiKey(val) {
  const n = (val || "").trim();
  try { if (window.storage?.set) await window.storage.set("openrouter-api-key", n); } catch {}
  try { window.localStorage.setItem("openrouter-api-key", n); } catch {}
}
function readEnvApiKey() {
  return (window.OPENROUTER_API_KEY || window.__OPENROUTER_API_KEY__ || window?.env?.OPENROUTER_API_KEY || "").trim();
}
function readEnvGroqKey() {
  return (window.GROQ_API_KEY || window.__GROQ_API_KEY__ || window?.env?.GROQ_API_KEY || "").trim();
}

// ─── Web Search via DuckDuckGo ───
async function performSearch(query) {
  const results = [];

  // Primary: DuckDuckGo HTML via CORS proxy (real search results)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(CORS_PROXY + encodeURIComponent(ddgUrl));
    if (res.ok) {
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll(".result, .web-result").forEach(item => {
        const a = item.querySelector(".result__a, .result-link");
        const snip = item.querySelector(".result__snippet, .result-snippet");
        if (a) {
          const href = a.getAttribute("href") || "";
          const urlMatch = href.match(/uddg=([^&]+)/);
          const url = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
          if (url.startsWith("http")) {
            results.push({
              title: a.textContent.trim(),
              snippet: snip?.textContent?.trim() || "",
              url,
            });
          }
        }
      });
    }
  } catch (e) { console.warn("DDG HTML search failed:", e); }

  // Fallback: DuckDuckGo JSON API (instant answers)
  if (results.length === 0) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.AbstractText) {
          results.push({ title: data.Heading || "Summary", snippet: data.AbstractText, url: data.AbstractURL || "" });
        }
        for (const t of (data.RelatedTopics || [])) {
          if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 100), snippet: t.Text, url: t.FirstURL });
          for (const sub of (t.Topics || [])) {
            if (sub.Text && sub.FirstURL) results.push({ title: sub.Text.slice(0, 100), snippet: sub.Text, url: sub.FirstURL });
          }
        }
      }
    } catch (e) { console.warn("DDG API failed:", e); }
  }

  return results.filter(r => r.url).slice(0, 12);
}

// ─── Fetch page text for AI reading ───
async function fetchPageText(url) {
  try {
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) return null;
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav,footer,header,aside,iframe,noscript,svg").forEach(el => el.remove());
    const text = (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 4000);
  } catch { return null; }
}

// ─── iframe control script (injected into fetched pages) ───
// Written in ES5 so serialization via .toString() works predictably
function _iframeCtrl() {
  function reply(e, id, payload) {
    try { e.source.postMessage({ meowBrowser: true, type: "cmdReply", id: id, payload: payload }, "*"); } catch(ex) {}
  }
  window.addEventListener("message", function(e) {
    var d = e.data;
    if (!d || !d.meowBrowserCmd) return;
    var id = d.id;
    if (d.cmd === "read") {
      var clone = document.body ? document.body.cloneNode(true) : null;
      if (clone) { var rm = clone.querySelectorAll("script,style,noscript,iframe,svg"); for (var i=0;i<rm.length;i++) rm[i].parentNode && rm[i].parentNode.removeChild(rm[i]); }
      var text = ((clone && clone.textContent) || "").replace(/\s+/g, " ").trim().slice(0, 6000);
      var aEls = document.querySelectorAll("a[href]");
      var links = [];
      for (var i = 0; i < Math.min(aEls.length, 20); i++) links.push({ text: (aEls[i].textContent || "").trim().slice(0, 60), href: aEls[i].href });
      var inpEls = document.querySelectorAll("input,textarea,select,button");
      var inputs = [];
      for (var i = 0; i < Math.min(inpEls.length, 20); i++) {
        var el = inpEls[i];
        inputs.push({ tag: el.tagName.toLowerCase(), type: el.type || "", id: el.id || "", name: el.name || "", placeholder: el.placeholder || "", text: (el.textContent || "").trim().slice(0, 40) });
      }
      reply(e, id, { text: text, title: document.title, links: links, inputs: inputs });
    } else if (d.cmd === "click") {
      var sel = d.selector, el = null;
      try { el = document.querySelector(sel); } catch(ex) {}
      if (!el) {
        var cands = document.querySelectorAll("a,button,input[type=submit],input[type=button],[onclick],[role=button]");
        for (var i = 0; i < cands.length; i++) { if ((cands[i].textContent || "").trim().toLowerCase().indexOf(sel.toLowerCase()) >= 0) { el = cands[i]; break; } }
      }
      if (!el) {
        var all = document.querySelectorAll("*");
        for (var i = 0; i < all.length; i++) { if (all[i].children.length === 0 && (all[i].textContent || "").trim().toLowerCase().indexOf(sel.toLowerCase()) >= 0) { el = all[i]; break; } }
      }
      if (el) {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch(ex) {}
        var rect = el.getBoundingClientRect();
        var prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
        el.style.outline = "2px solid #7ce08a"; el.style.outlineOffset = "2px";
        setTimeout(function() { try { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; } catch(ex){} }, 1400);
        try { el.click(); } catch(ex) {}
        reply(e, id, { success: true, element: el.tagName, text: (el.textContent || "").trim().slice(0, 40), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      } else { reply(e, id, { success: false, error: "Element not found: " + sel }); }
    } else if (d.cmd === "type") {
      var sel = d.selector, text = d.text, el = null;
      try { el = document.querySelector(sel); } catch(ex) {}
      if (!el) {
        var inps = document.querySelectorAll("input,textarea");
        for (var i = 0; i < inps.length; i++) {
          var inp = inps[i];
          if (((inp.placeholder || "") + (inp.name || "") + (inp.id || "")).toLowerCase().indexOf(sel.toLowerCase()) >= 0) { el = inp; break; }
        }
      }
      if (el) {
        try { el.focus(); el.value = text; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } catch(ex) {}
        reply(e, id, { success: true });
      } else { reply(e, id, { success: false, error: "Input not found: " + sel }); }
    } else if (d.cmd === "scroll") {
      var dir = d.direction, amt = d.amount || 300;
      if (dir === "up") window.scrollBy(0, -amt);
      else if (dir === "down") window.scrollBy(0, amt);
      else if (dir === "top") window.scrollTo(0, 0);
      else if (dir === "bottom") window.scrollTo(0, document.body ? document.body.scrollHeight : 0);
      reply(e, id, { success: true });
    } else if (d.cmd === "find") {
      var q = (d.query || "").toLowerCase();
      var fEls = document.querySelectorAll("a,button,input,textarea,select,[onclick],[role=button],[role=link]");
      var matches = [];
      for (var i = 0; i < fEls.length && matches.length < 10; i++) {
        var el = fEls[i];
        var t = ((el.textContent || "") + (el.id || "") + (el.name || "") + (el.placeholder || "") + (el.className || "")).toLowerCase();
        if (t.indexOf(q) >= 0) matches.push({ tag: el.tagName, id: el.id || "", text: (el.textContent || "").trim().slice(0, 50), href: el.href || "" });
      }
      reply(e, id, { matches: matches });
    }
  });
}

// ─── Popup window script (runs in popup, serialized via .toString()) ───
function _popupScript(cfg) {
  var PROXY = cfg.proxy;
  var IFRAME_CTRL = cfg.iframeCtrl;
  var iframe, urlInput, loadingOverlay, loadingText, agentLog, statusText, statusMode, agentBadge, agentBadgeText, takeoverBtn, clickIndicator, agentPanel, panelToggle;
  var currentUrl = "", agentMode = true, navHistory = [], histIdx = -1, panelCollapsed = false;

  function init() {
    iframe = document.getElementById("pf");
    urlInput = document.getElementById("ui");
    loadingOverlay = document.getElementById("lo");
    loadingText = document.getElementById("lt");
    agentLog = document.getElementById("al");
    statusText = document.getElementById("st");
    statusMode = document.getElementById("sm");
    agentBadge = document.getElementById("ab");
    agentBadgeText = document.getElementById("abt");
    takeoverBtn = document.getElementById("tb");
    clickIndicator = document.getElementById("ci");
    agentPanel = document.getElementById("ap");
    panelToggle = document.getElementById("pt");

    document.getElementById("back-btn").onclick = goBack;
    document.getElementById("fwd-btn").onclick = goForward;
    document.getElementById("reload-btn").onclick = doReload;
    document.getElementById("go-btn").onclick = doGo;
    takeoverBtn.onclick = toggleTakeover;
    urlInput.onkeydown = function(e) { if (e.key === "Enter") doGo(); };
    document.getElementById("ph").onclick = togglePanel;
    window.addEventListener("message", onMessage);
    hideLoading();
    addLog("Browser ready — AI agent mode active", "ok");
    notifyParent("ready", {});
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  function addLog(msg, type) {
    var ts = new Date().toLocaleTimeString("en", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    var d = document.createElement("div");
    d.className = "le " + (type || "");
    d.innerHTML = "<span class=\"ts\">" + ts + "</span><span>" + esc(msg) + "</span>";
    agentLog.appendChild(d);
    agentLog.scrollTop = agentLog.scrollHeight;
    if (agentLog.children.length > 100) agentLog.firstChild && agentLog.firstChild.parentNode && agentLog.firstChild.parentNode.removeChild(agentLog.firstChild);
  }

  function showLoading(url) { loadingOverlay.style.display = "flex"; loadingText.textContent = "Loading " + (url || "").slice(0, 55) + "..."; }
  function hideLoading() { loadingOverlay.style.display = "none"; }

  function updateUrl(url) {
    urlInput.value = url; currentUrl = url;
    statusText.textContent = url || "about:blank";
    document.getElementById("back-btn").disabled = histIdx <= 0;
    document.getElementById("fwd-btn").disabled = histIdx >= navHistory.length - 1;
    notifyParent("urlChange", { url: url });
  }

  function notifyParent(type, payload) {
    try { window.opener && window.opener.postMessage({ meowBrowser: true, type: type, payload: payload }, "*"); } catch(e) {}
  }

  function navigateTo(url, replyId) {
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    showLoading(url);
    addLog("Navigate: " + url.slice(0, 65), "nav");
    fetch(PROXY + encodeURIComponent(url))
      .then(function(r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function(html) {
        html = fixBase(html, url);
        html = injectCtrl(html);
        var blob = new Blob([html], { type: "text/html" });
        var blobUrl = URL.createObjectURL(blob);
        iframe.onload = function() {
          hideLoading(); updateUrl(url);
          if (navHistory[histIdx] !== url) { navHistory = navHistory.slice(0, histIdx + 1); navHistory.push(url); histIdx = navHistory.length - 1; }
          addLog("Loaded: " + url.slice(0, 55), "ok");
          if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: true, url: url } });
        };
        iframe.src = blobUrl;
      })
      .catch(function(e) {
        hideLoading(); addLog("Error: " + e.message, "err");
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: false, error: e.message } });
      });
  }

  function fixBase(html, url) {
    try {
      var u = new URL(url);
      var base = u.origin + u.pathname.split("/").slice(0, -1).join("/") + "/";
      var tag = "<base href=\"" + base + "\">";
      var replaced = html.replace(/<head[^>]*>/i, function(m) { return m + tag; });
      if (replaced === html) html = "<head>" + tag + "</head>" + html; else html = replaced;
    } catch(e) {}
    return html;
  }

  function injectCtrl(html) {
    var scriptTag = "<scr" + "ipt>" + IFRAME_CTRL + "<\/scr" + "ipt>";
    var replaced = html.replace(/<\/head>/i, scriptTag + "</head>");
    return replaced !== html ? replaced : (scriptTag + html);
  }

  function doGo() { var u = urlInput.value.trim(); if (u) navigateTo(u); }
  function goBack() { if (histIdx > 0) { histIdx--; navigateTo(navHistory[histIdx]); } }
  function goForward() { if (histIdx < navHistory.length - 1) { histIdx++; navigateTo(navHistory[histIdx]); } }
  function doReload() { if (currentUrl) navigateTo(currentUrl); }

  function toggleTakeover() {
    agentMode = !agentMode;
    if (!agentMode) {
      agentBadge.className = "badge inactive"; agentBadgeText.textContent = "AI PAUSED";
      takeoverBtn.textContent = "Resume AI"; takeoverBtn.className = "tbtn resume";
      statusMode.textContent = "USER MODE"; statusMode.style.color = "#cc7777";
      addLog("User took control \u2014 AI paused", "err");
      notifyParent("userTookOver", {});
    } else {
      agentBadge.className = "badge"; agentBadgeText.textContent = "AI AGENT";
      takeoverBtn.textContent = "Take Over"; takeoverBtn.className = "tbtn";
      statusMode.textContent = "AI MODE"; statusMode.style.color = "#7ce08a";
      addLog("AI control resumed", "ok");
      notifyParent("aiResumed", {});
    }
  }

  function togglePanel() {
    panelCollapsed = !panelCollapsed;
    agentPanel.classList.toggle("collapsed", panelCollapsed);
    panelToggle.textContent = panelCollapsed ? "\u25b8" : "\u25be";
  }

  function showClick(x, y) {
    clickIndicator.style.left = x + "px"; clickIndicator.style.top = y + "px";
    clickIndicator.style.display = "block";
    setTimeout(function() { clickIndicator.style.display = "none"; }, 700);
  }

  function onMessage(e) {
    var d = e.data;
    if (!d || !d.meowBrowser) return;
    // Forward iframe replies to parent
    if (d.type === "cmdReply") {
      notifyParent_raw(d);
      if (d.payload && d.payload.x != null) showClick(d.payload.x, d.payload.y);
      return;
    }
    var id = d.id, data = d.data || {};
    if (d.cmd === "navigate") { navigateTo(data.url, id); }
    else if (d.cmd === "click") {
      if (!agentMode) { notifyParent("cmdReply", { id: id, type: "cmdReply", payload: { success: false, error: "User has taken over" } }); return; }
      addLog("Click: " + data.selector);
      iframe.contentWindow && iframe.contentWindow.postMessage({ meowBrowserCmd: true, cmd: "click", id: id, selector: data.selector }, "*");
    } else if (d.cmd === "type") {
      if (!agentMode) { notifyParent("cmdReply", { id: id, type: "cmdReply", payload: { success: false, error: "User has taken over" } }); return; }
      addLog("Type \u201c" + data.text + "\u201d \u2192 " + data.selector);
      iframe.contentWindow && iframe.contentWindow.postMessage({ meowBrowserCmd: true, cmd: "type", id: id, selector: data.selector, text: data.text }, "*");
    } else if (d.cmd === "read") {
      addLog("Reading page content...");
      iframe.contentWindow && iframe.contentWindow.postMessage({ meowBrowserCmd: true, cmd: "read", id: id }, "*");
    } else if (d.cmd === "scroll") {
      if (!agentMode) return;
      addLog("Scroll: " + data.direction);
      iframe.contentWindow && iframe.contentWindow.postMessage({ meowBrowserCmd: true, cmd: "scroll", id: id, direction: data.direction, amount: data.amount || 300 }, "*");
    } else if (d.cmd === "find") {
      iframe.contentWindow && iframe.contentWindow.postMessage({ meowBrowserCmd: true, cmd: "find", id: id, query: data.query }, "*");
    } else if (d.cmd === "logMsg") {
      addLog(data.msg, data.type || "");
    }
  }

  function notifyParent_raw(msg) {
    try { window.opener && window.opener.postMessage(msg, "*"); } catch(e) {}
  }

  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
}

// ─── Build popup HTML (blob) ───
function buildPopupHtml() {
  var iframeCtrlSrc = "(" + _iframeCtrl.toString() + ")()";
  var popupScriptSrc = "(" + _popupScript.toString() + ")(" + JSON.stringify({ proxy: CORS_PROXY, iframeCtrl: iframeCtrlSrc }) + ")";
  var css = [
    "* { box-sizing: border-box; margin: 0; padding: 0; }",
    "body { background: #07070b; color: #ccccda; font-family: 'Segoe UI', system-ui, sans-serif; height: 100vh; display: flex; flex-direction: column; overflow: hidden; font-size: 12px; }",
    "#toolbar { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: #0d0d14; border-bottom: 1px solid #181824; flex-shrink: 0; }",
    ".nav-btn { background: rgba(255,255,255,0.05); border: 1px solid #181824; border-radius: 5px; color: #888; cursor: pointer; padding: 4px 8px; font-size: 13px; line-height: 1; }",
    ".nav-btn:hover { background: rgba(255,255,255,0.1); color: #ccc; } .nav-btn:disabled { opacity: 0.3; cursor: default; }",
    "#ui { flex: 1; background: rgba(255,255,255,0.04); border: 1px solid #181824; border-radius: 6px; color: #ccccda; font-size: 11px; padding: 5px 10px; outline: none; font-family: 'JetBrains Mono', monospace; }",
    "#ui:focus { border-color: rgba(136,187,204,0.4); }",
    "#go-btn { background: rgba(136,187,204,0.1); border: 1px solid rgba(136,187,204,0.3); border-radius: 5px; color: #88bbcc; cursor: pointer; padding: 5px 10px; font-size: 11px; }",
    "#go-btn:hover { background: rgba(136,187,204,0.2); }",
    ".badge { padding: 3px 8px; border-radius: 5px; font-size: 10px; font-weight: 700; background: rgba(124,224,138,0.1); border: 1px solid rgba(124,224,138,0.3); color: #7ce08a; display: flex; align-items: center; gap: 4px; white-space: nowrap; letter-spacing: 0.5px; }",
    ".badge.inactive { background: rgba(255,255,255,0.03); border-color: #181824; color: #555; }",
    ".tbtn { padding: 4px 10px; border-radius: 5px; font-size: 10px; background: rgba(204,119,119,0.1); border: 1px solid rgba(204,119,119,0.3); color: #cc7777; cursor: pointer; white-space: nowrap; }",
    ".tbtn:hover { background: rgba(204,119,119,0.2); } .tbtn.resume { background: rgba(124,224,138,0.1); border-color: rgba(124,224,138,0.3); color: #7ce08a; }",
    "#content-area { flex: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }",
    "#pf { width: 100%; flex: 1; border: none; background: #fff; min-height: 0; }",
    "#lo { position: absolute; inset: 0; background: rgba(7,7,11,0.95); display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 100; }",
    ".spin { width: 30px; height: 30px; border: 3px solid #181824; border-top-color: #7ce08a; border-radius: 50%; animation: spin 0.8s linear infinite; }",
    "@keyframes spin { to { transform: rotate(360deg); } }",
    "#ap { background: rgba(7,7,11,0.96); border-top: 1px solid #181824; backdrop-filter: blur(10px); transition: max-height 0.25s; overflow: hidden; max-height: 170px; flex-shrink: 0; }",
    "#ap.collapsed { max-height: 28px; }",
    "#ph { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; cursor: pointer; user-select: none; }",
    "#pt-label { font-size: 9px; font-weight: 700; color: #7ce08a; font-family: monospace; letter-spacing: 1px; display: flex; align-items: center; gap: 6px; }",
    "#al { padding: 5px 10px 8px; overflow-y: auto; max-height: 138px; display: flex; flex-direction: column; gap: 2px; }",
    ".le { font-size: 10px; font-family: 'JetBrains Mono', monospace; color: #88bbcc; padding: 1px 5px; border-radius: 3px; background: rgba(136,187,204,0.04); display: flex; gap: 8px; align-items: baseline; animation: fi 0.2s ease; }",
    ".le .ts { color: #333; font-size: 9px; flex-shrink: 0; }",
    ".le.err { color: #cc7777; background: rgba(204,119,119,0.04); } .le.ok { color: #7ce08a; background: rgba(124,224,138,0.04); } .le.nav { color: #aaa; }",
    "@keyframes fi { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }",
    "#ci { position: absolute; width: 22px; height: 22px; border: 2px solid #7ce08a; border-radius: 50%; pointer-events: none; transform: translate(-50%,-50%); z-index: 200; display: none; animation: ca 0.6s forwards; }",
    "@keyframes ca { 0%{opacity:1;transform:translate(-50%,-50%) scale(0.4)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.3)} 100%{opacity:0;transform:translate(-50%,-50%) scale(1.6)} }",
    "#sb { display: flex; align-items: center; gap: 8px; padding: 2px 10px; background: #080810; border-top: 1px solid rgba(255,255,255,0.03); font-size: 9px; font-family: monospace; color: #444; flex-shrink: 0; }",
    "#st { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } #sm { color: #7ce08a; font-weight: 700; }"
  ].join("\n");

  var body = [
    '<div id="toolbar">',
    '  <button class="nav-btn" id="back-btn" disabled>&#9664;</button>',
    '  <button class="nav-btn" id="fwd-btn" disabled>&#9654;</button>',
    '  <button class="nav-btn" id="reload-btn">&#8635;</button>',
    '  <input id="ui" type="text" placeholder="Enter URL or search query...">',
    '  <button id="go-btn">Go</button>',
    '  <div class="badge" id="ab"><span>&#9679;</span><span id="abt">AI AGENT</span></div>',
    '  <button class="tbtn" id="tb">Take Over</button>',
    '</div>',
    '<div id="content-area">',
    '  <iframe id="pf" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-top-navigation-by-user-activation"></iframe>',
    '  <div id="lo"><div class="spin"></div><div id="lt" style="font-size:11px;color:#555;font-family:monospace">Loading...</div></div>',
    '  <div id="ci"></div>',
    '  <div id="ap">',
    '    <div id="ph"><span id="pt-label">&#9636; AGENT LOG</span><span id="pt">&#9660;</span></div>',
    '    <div id="al"></div>',
    '  </div>',
    '</div>',
    '<div id="sb"><span id="st">Ready</span><span id="sm">AI MODE</span></div>'
  ].join("\n");

  return "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Meow Browser</title><style>" + css + "</style></head><body>" + body + "<script>" + popupScriptSrc + "<\/script></body></html>";
}

// ─── Agent Browser Manager ───
var agentBrowser = (function() {
  var popup = null, currentUrl = "", agentMode = true;
  var pendingResolvers = {}, msgId = 0;
  var listenerAdded = false;
  var onUrlChangeCb = null, onUserTookOverCb = null;
  var pendingInitUrl = null, isReady = false, readyResolvers = [];

  function initListener(onUrlChange, onUserTookOver) {
    onUrlChangeCb = onUrlChange; onUserTookOverCb = onUserTookOver;
    if (listenerAdded) return;
    listenerAdded = true;
    window.addEventListener("message", function(e) {
      var d = e.data;
      if (!d || !d.meowBrowser) return;
      if (d.type === "cmdReply") {
        var res = pendingResolvers[d.id];
        if (res) { delete pendingResolvers[d.id]; res(d.payload); }
        return;
      }
      if (d.type === "urlChange") { currentUrl = (d.payload && d.payload.url) || ""; onUrlChangeCb && onUrlChangeCb(currentUrl); }
      if (d.type === "userTookOver") { agentMode = false; onUserTookOverCb && onUserTookOverCb(); }
      if (d.type === "aiResumed") { agentMode = true; }
      if (d.type === "ready") {
        isReady = true;
        var rrs = readyResolvers.splice(0);
        rrs.forEach(function(r) { r(); });
        if (pendingInitUrl) { var navUrl = pendingInitUrl; pendingInitUrl = null; _send("navigate", { url: navUrl }, true); }
      }
    });
  }

  function isOpen() { return popup && !popup.closed; }

  function open(url) {
    initListener(onUrlChangeCb, onUserTookOverCb);
    if (!isOpen()) {
      var html = buildPopupHtml();
      var blob = new Blob([html], { type: "text/html" });
      var blobUrl = URL.createObjectURL(blob);
      pendingInitUrl = url || null;
      isReady = false;
      popup = window.open(blobUrl, "meow_browser", "width=1100,height=760,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes");
    } else {
      if (url) _send("navigate", { url: url });
      popup.focus();
    }
  }

  function _send(cmd, data, waitForReply) {
    if (!isOpen()) return Promise.resolve(null);
    var id = ++msgId;
    popup.postMessage({ meowBrowser: true, id: id, cmd: cmd, data: data || {} }, "*");
    if (!waitForReply) return Promise.resolve(null);
    return new Promise(function(resolve) {
      pendingResolvers[id] = resolve;
      setTimeout(function() { if (pendingResolvers[id]) { delete pendingResolvers[id]; resolve(null); } }, 15000);
    });
  }

  return {
    get currentUrl() { return currentUrl; },
    get agentMode() { return agentMode; },
    initListener: initListener,
    isOpen: isOpen,
    open: open,
    navigate: function(url) { if (!isOpen()) { open(url); return Promise.resolve(null); } return _send("navigate", { url: url }, true); },
    waitForReady: function() {
      if (isReady && isOpen()) return Promise.resolve();
      return new Promise(function(resolve) {
        readyResolvers.push(resolve);
        setTimeout(function() { var idx = readyResolvers.indexOf(resolve); if (idx >= 0) { readyResolvers.splice(idx, 1); resolve(); } }, 8000);
      });
    },
    click: function(sel) { return _send("click", { selector: sel }, true); },
    type: function(sel, text) { return _send("type", { selector: sel, text: text }, true); },
    read: function() { return _send("read", {}, true); },
    scroll: function(dir) { return _send("scroll", { direction: dir }, true); },
    find: function(q) { return _send("find", { query: q }, true); },
    logMsg: function(msg, type) { _send("logMsg", { msg: msg, type: type || "" }); },
    focus: function() { if (isOpen()) popup.focus(); },
  };
})();

function openBrowserPopup(url) { agentBrowser.open(url); }
function isBrowserOpen() { return agentBrowser.isOpen(); }

// ─── Error parsing ───
function parseErrorMessage(rawBody, status) {
  let parsed;
  try { parsed = JSON.parse(rawBody); } catch {}
  const fromParsed = parsed?.error?.message || parsed?.message || parsed?.detail;
  if (typeof fromParsed === "string" && fromParsed.trim()) return fromParsed.trim();
  return (rawBody || "").trim() || `HTTP ${status}`;
}

// ─── Markdown Renderer ───
function Md({ text }) {
  if (!text) return null;
  const els = []; const lines = text.split("\n"); let i = 0, k = 0;
  while (i < lines.length) {
    const L = lines[i];
    if (L.trimStart().startsWith("```")) {
      const lang = L.trimStart().slice(3).trim(); const cl = []; i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) { cl.push(lines[i]); i++; }
      if (i < lines.length) i++;
      const code = cl.join("\n");
      els.push(<div key={k++} style={{ position: "relative", margin: "10px 0", borderRadius: "8px", overflow: "hidden", border: "1px solid #1d1d28" }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", background: "#101018", fontSize: "10px", fontFamily: "var(--m)", color: "#555", textTransform: "uppercase", letterSpacing: "0.7px" }}>
          <span>{lang || "code"}</span>
          <button onClick={() => navigator.clipboard.writeText(code)} style={{ background: "none", border: "none", color: "#7a7", cursor: "pointer", fontSize: "10px", fontFamily: "var(--m)" }}>copy</button>
        </div>
        <pre style={{ margin: 0, padding: "12px", background: "#0a0a12", overflowX: "auto", fontSize: "12.5px", fontFamily: "var(--m)", lineHeight: 1.6, color: "#aed4a0", tabSize: 2 }}><code>{code}</code></pre>
      </div>); continue;
    }
    if (L.startsWith("### ")) els.push(<h4 key={k++} style={{ margin: "14px 0 4px", fontSize: "13px", fontWeight: 600, color: "#8bc" }}>{il(L.slice(4))}</h4>);
    else if (L.startsWith("## ")) els.push(<h3 key={k++} style={{ margin: "16px 0 5px", fontSize: "15px", fontWeight: 700, color: "#dde" }}>{il(L.slice(3))}</h3>);
    else if (L.startsWith("# ")) els.push(<h2 key={k++} style={{ margin: "18px 0 6px", fontSize: "17px", fontWeight: 700, color: "#eef" }}>{il(L.slice(2))}</h2>);
    else if (L.startsWith("> ")) els.push(<blockquote key={k++} style={{ margin: "8px 0", padding: "6px 12px", borderLeft: "3px solid #8bc", background: "rgba(136,187,204,0.04)", borderRadius: "0 6px 6px 0", color: "#99a" }}>{il(L.slice(2))}</blockquote>);
    else if (/^[\-\*]\s/.test(L)) els.push(<div key={k++} style={{ display: "flex", gap: "7px", margin: "2px 0", paddingLeft: "2px" }}><span style={{ color: "#7a7", flexShrink: 0, fontSize: "9px", marginTop: "3px" }}>●</span><span style={{ flex: 1 }}>{il(L.replace(/^[\-\*]\s/, ""))}</span></div>);
    else if (/^\d+\.\s/.test(L)) { const m = L.match(/^(\d+)\.\s(.*)/); els.push(<div key={k++} style={{ display: "flex", gap: "7px", margin: "2px 0", paddingLeft: "2px" }}><span style={{ color: "#8bc", flexShrink: 0, fontFamily: "var(--m)", fontSize: "12px", minWidth: "16px", textAlign: "right" }}>{m[1]}.</span><span style={{ flex: 1 }}>{il(m[2])}</span></div>); }
    else if (L.trim() === "") els.push(<div key={k++} style={{ height: "8px" }} />);
    else els.push(<p key={k++} style={{ margin: "3px 0", lineHeight: 1.7 }}>{il(L)}</p>);
    i++;
  }
  return <div>{els}</div>;
}
function il(t) {
  if (typeof t !== "string") return t;
  const p = []; let i = 0, k = 0;
  while (i < t.length) {
    if (t[i] === "`") { const e = t.indexOf("`", i + 1); if (e > i) { p.push(<code key={k++} style={{ background: "rgba(170,210,160,0.08)", color: "#aed4a0", padding: "1px 4px", borderRadius: "3px", fontSize: "0.88em", fontFamily: "var(--m)" }}>{t.slice(i + 1, e)}</code>); i = e + 1; continue; } }
    if (t[i] === "*" && t[i + 1] === "*") { const e = t.indexOf("**", i + 2); if (e > i) { p.push(<strong key={k++} style={{ color: "#e0e0ea", fontWeight: 600 }}>{t.slice(i + 2, e)}</strong>); i = e + 2; continue; } }
    if (t[i] === "*" && t[i + 1] !== "*") { const e = t.indexOf("*", i + 1); if (e > i) { p.push(<em key={k++} style={{ color: "#888" }}>{t.slice(i + 1, e)}</em>); i = e + 1; continue; } }
    if (t[i] === "[") { const cb = t.indexOf("](", i); const cp = cb > i ? t.indexOf(")", cb + 2) : -1; if (cb > i && cp > cb) { p.push(<a key={k++} href={t.slice(cb + 2, cp)} target="_blank" rel="noopener" style={{ color: "#8bc", textDecoration: "underline" }}>{t.slice(i + 1, cb)}</a>); i = cp + 1; continue; } }
    let j = i; while (j < t.length && !"`*[".includes(t[j])) j++; p.push(t.slice(i, j)); i = j;
  }
  return p;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
function Meow() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [mem, setMem] = useState("");
  const [memDraft, setMemDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("browser"); // "browser" | "memory"
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("");
  const [usage, setUsage] = useState({ i: 0, o: 0 });
  const [apiKey, setApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [researchStatus, setResearchStatus] = useState("");
  const [agentBrowserUrl, setAgentBrowserUrl] = useState("");
  const [agentUserTookOver, setAgentUserTookOver] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  const promptForApiKey = useCallback((reason = "Enter your OpenRouter API key:") => {
    const enteredKey = window.prompt(reason);
    const normalizedKey = (enteredKey || "").trim();
    if (!normalizedKey) return "";
    setApiKey(normalizedKey);
    saveApiKey(normalizedKey);
    return normalizedKey;
  }, []);

  const promptForGroqKey = useCallback((reason = "Enter your Groq API key:") => {
    const enteredKey = window.prompt(reason);
    const normalizedKey = (enteredKey || "").trim();
    if (!normalizedKey) return "";
    setGroqApiKey(normalizedKey);
    saveVal("groq-api-key", normalizedKey);
    return normalizedKey;
  }, []);

  // Load on mount
  useEffect(() => {
    loadVal("meow-memory").then(v => { setMem(v || ""); setMemDraft(v || ""); });
    loadChat().then(v => { if (v?.length) setMsgs(v); });
    (async () => {
      const envKey = readEnvApiKey();
      if (envKey) { setApiKey(envKey); return; }
      const storedKey = await loadApiKey();
      if (storedKey) { setApiKey(storedKey); return; }
      promptForApiKey();
    })();
    (async () => {
      const envGroqKey = readEnvGroqKey();
      if (envGroqKey) { setGroqApiKey(envGroqKey); return; }
      const storedGroqKey = await loadVal("groq-api-key");
      if (storedGroqKey) setGroqApiKey(storedGroqKey);
    })();
    // Init agent browser event listeners
    agentBrowser.initListener(
      (url) => setAgentBrowserUrl(url),
      () => setAgentUserTookOver(true)
    );
  }, [promptForApiKey]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  // ─── Memory helpers ───
  const saveMem = useCallback(() => {
    setMem(memDraft);
    saveVal("meow-memory", memDraft);
  }, [memDraft]);

  const downloadMem = () => {
    const blob = new Blob([memDraft], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "meow-memory.txt"; a.click(); URL.revokeObjectURL(a.href);
  };

  const uploadMem = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt";
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { const t = r.result; setMemDraft(t); setMem(t); saveVal("meow-memory", t); };
      r.readAsText(f);
    }; inp.click();
  };

  // ─── Search handler ───
  const doSearch = useCallback(async (query) => {
    if (!query?.trim()) return [];
    setSearchBusy(true);
    setSearchResults([]);
    try {
      const results = await performSearch(query.trim());
      setSearchResults(results);
      return results;
    } catch (e) {
      console.error("Search error:", e);
      return [];
    } finally {
      setSearchBusy(false);
    }
  }, []);

  const handleSearchSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    doSearch(searchQuery);
  }, [searchQuery, doSearch]);

  const handleBrowserGo = useCallback(() => {
    if (!browserUrl.trim()) return;
    let url = browserUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    openBrowserPopup(url);
  }, [browserUrl]);

  // ─── System prompt builder ───
  const buildSystem = useCallback(() => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let s = `You are Meow, a brilliant, warm AI assistant with internet research capabilities. You are curious, helpful, and thorough. Use markdown formatting. Today is ${today}.`;

    // Memory instructions
    if (mem.trim()) {
      s += `\n\n<memory>\nBelow is your persistent memory (saved to memory.txt and shown in chat). Reference it when relevant. If the user tells you to remember something, include a <memory_update> block at the END of your response with the COMPLETE updated memory content (not a diff).\n${mem}\n</memory>`;
    } else {
      s += `\n\nYou have a persistent memory system (memory.txt, visible in chat). If the user asks you to remember something, include a <memory_update> block at the END of your response with the content to remember.`;
    }
    s += `\nIMPORTANT: When you update memory, wrap the FULL new memory text in <memory_update>...</memory_update> tags at the very end of your response. The content REPLACES ALL existing memory. Update memory frequently to track conversations and important info.`;

    // Research / web search instructions
    s += `\n\n## Web Research Capability
You can search the internet and read web pages! When you need current information, facts, news, or want to research a topic:

1. **To search the web**: Include <web_search>your search query</web_search> in your response.
2. **To read a webpage**: Include <read_url>https://example.com</read_url> in your response.
3. **To open a page in the user's browser popup**: Include <open_browser>https://example.com</open_browser> in your response.

You should PROACTIVELY research when:
- The user asks about current events, news, or recent information
- You need to verify facts or find up-to-date data
- The user asks you to look something up or research a topic
- The topic involves recent developments, prices, statistics, etc.

When researching, search multiple queries if needed. Cite sources with URLs.

## AI Browser Agent Capability
You can DIRECTLY CONTROL a visual browser window! The user will see the browser popup and can take over at any time. Use these tags to control the browser:

1. **Navigate**: <browser_navigate>https://example.com</browser_navigate> — load a URL in the browser
2. **Click**: <browser_click>button text or CSS selector</browser_click> — click any element (searches by visible text too)
3. **Type**: <browser_type>selector :: text to type</browser_type> — type into an input (selector can be placeholder text, name, or CSS selector)
4. **Read page**: <browser_read/> — read the current page content, links, and form inputs (use this after navigating!)
5. **Scroll**: <browser_scroll>down</browser_scroll> — scroll the page (up/down/top/bottom)
6. **Find elements**: <browser_find>search text</browser_find> — find interactive elements matching text

**Browser agent workflow example:**
- Navigate to a site → Read page to understand it → Click/type to interact → Read again to see results
- You can chain multiple browser actions in one response — they execute in order
- After browser actions, you'll receive the results and can continue the task
- The user can click "Take Over" in the browser popup to control it themselves anytime

Use the browser agent for tasks like: filling out forms, searching websites directly, interacting with web apps, logging into sites, shopping, booking, etc.`;


    return s;
  }, [mem]);

  // ─── Parse AI response (memory updates, search triggers, browser commands) ───
  const parseResponse = useCallback((text) => {
    let cleaned = text;
    const actions = { memoryUpdate: null, searches: [], readUrls: [], openUrls: [], browserActions: [] };

    // Extract memory updates
    const memMatch = cleaned.match(/<memory_update>([\s\S]*?)<\/memory_update>/);
    if (memMatch) {
      actions.memoryUpdate = memMatch[1].trim();
      cleaned = cleaned.replace(/<memory_update>[\s\S]*?<\/memory_update>/, "").trim();
    }

    // Extract web search requests
    const searchMatches = cleaned.matchAll(/<web_search>([\s\S]*?)<\/web_search>/g);
    for (const m of searchMatches) actions.searches.push(m[1].trim());
    cleaned = cleaned.replace(/<web_search>[\s\S]*?<\/web_search>/g, "").trim();

    // Extract read URL requests
    const readMatches = cleaned.matchAll(/<read_url>([\s\S]*?)<\/read_url>/g);
    for (const m of readMatches) actions.readUrls.push(m[1].trim());
    cleaned = cleaned.replace(/<read_url>[\s\S]*?<\/read_url>/g, "").trim();

    // Extract open browser requests
    const openMatches = cleaned.matchAll(/<open_browser>([\s\S]*?)<\/open_browser>/g);
    for (const m of openMatches) actions.openUrls.push(m[1].trim());
    cleaned = cleaned.replace(/<open_browser>[\s\S]*?<\/open_browser>/g, "").trim();

    // ─── Browser Agent Actions ───
    // Navigate: <browser_navigate>https://example.com</browser_navigate>
    for (const m of cleaned.matchAll(/<browser_navigate>([\s\S]*?)<\/browser_navigate>/g))
      actions.browserActions.push({ type: "navigate", url: m[1].trim() });
    cleaned = cleaned.replace(/<browser_navigate>[\s\S]*?<\/browser_navigate>/g, "").trim();

    // Click: <browser_click>button text or CSS selector</browser_click>
    for (const m of cleaned.matchAll(/<browser_click>([\s\S]*?)<\/browser_click>/g))
      actions.browserActions.push({ type: "click", selector: m[1].trim() });
    cleaned = cleaned.replace(/<browser_click>[\s\S]*?<\/browser_click>/g, "").trim();

    // Type: <browser_type>selector :: text to type</browser_type>
    for (const m of cleaned.matchAll(/<browser_type>([\s\S]*?)<\/browser_type>/g)) {
      const parts = m[1].split(" :: ");
      if (parts.length >= 2) actions.browserActions.push({ type: "type", selector: parts[0].trim(), text: parts.slice(1).join(" :: ").trim() });
      else actions.browserActions.push({ type: "type", selector: "input,textarea", text: m[1].trim() });
    }
    cleaned = cleaned.replace(/<browser_type>[\s\S]*?<\/browser_type>/g, "").trim();

    // Read: <browser_read/> or <browser_read></browser_read>
    if (/<browser_read\s*\/?>/.test(cleaned) || /<browser_read>[\s\S]*?<\/browser_read>/.test(cleaned))
      actions.browserActions.push({ type: "read" });
    cleaned = cleaned.replace(/<browser_read\s*\/?>/g, "").replace(/<browser_read>[\s\S]*?<\/browser_read>/g, "").trim();

    // Scroll: <browser_scroll>down</browser_scroll>  (up/down/top/bottom)
    for (const m of cleaned.matchAll(/<browser_scroll>([\s\S]*?)<\/browser_scroll>/g))
      actions.browserActions.push({ type: "scroll", direction: m[1].trim() });
    cleaned = cleaned.replace(/<browser_scroll>[\s\S]*?<\/browser_scroll>/g, "").trim();

    // Find: <browser_find>search button</browser_find>
    for (const m of cleaned.matchAll(/<browser_find>([\s\S]*?)<\/browser_find>/g))
      actions.browserActions.push({ type: "find", query: m[1].trim() });
    cleaned = cleaned.replace(/<browser_find>[\s\S]*?<\/browser_find>/g, "").trim();

    return { text: cleaned, actions };
  }, []);

  // ─── Call AI API ───
  const callAI = useCallback(async (apiMsgs, key, groqKey) => {
    const buildBody = (model) => ({ model, messages: apiMsgs });
    let data = null;
    let usedModel = DEFAULT_MODEL;
    let lastErr = null;

    // Try OpenRouter
    if (key) {
      for (const model of MODEL_FALLBACKS) {
        let res;
        try {
          res = await fetch(API, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${key}`,
              "HTTP-Referer": window.location.origin,
              "X-Title": "Meow Agent",
            },
            body: JSON.stringify(buildBody(model)),
            signal: abortRef.current?.signal,
          });
        } catch (e) {
          if (e.name === "AbortError") throw e;
          lastErr = e;
          break;
        }

        if (res.ok) {
          data = await res.json();
          usedModel = model;
          break;
        }

        const rawBody = await res.text();
        const msg = parseErrorMessage(rawBody, res.status);
        lastErr = new Error(msg);

        const invalidModel = /valid model id|model.*not found|no such model/i.test(msg);
        if (!invalidModel || model === MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) {
          break;
        }
      }
    }

    // Fall back to Groq if OpenRouter failed
    if (!data && groqKey) {
      try {
        const res = await fetch(GROQ_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify(buildBody(GROQ_MODEL)),
          signal: abortRef.current?.signal,
        });

        if (res.ok) {
          data = await res.json();
          usedModel = GROQ_MODEL;
          lastErr = null;
        } else {
          const rawBody = await res.text();
          const msg = parseErrorMessage(rawBody, res.status);
          lastErr = new Error(`Groq: ${msg}`);
        }
      } catch (e) {
        if (e.name === "AbortError") throw e;
        lastErr = e;
      }
    }

    if (!data) throw lastErr || new Error("Failed to get a completion.");
    return { data, usedModel };
  }, []);

  // ─── Main send function with research loop ───
  const send = useCallback(async () => {
    const txt = input.trim();
    if (!txt || busy) return;
    setErr(null); setBusy(true); setResearchStatus("");

    const userMsg = { role: "user", content: txt };
    let currentMsgs = [...msgs, userMsg];
    setMsgs(currentMsgs); setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    try {
      let key = (apiKey || readEnvApiKey() || (await loadApiKey()) || "").trim();
      let groqKey = (groqApiKey || readEnvGroqKey() || (await loadVal("groq-api-key")) || "").trim();
      if (!key && !groqKey) {
        key = promptForApiKey("Missing API key. Enter your OpenRouter key:");
        if (!key) throw new Error("Missing API key.");
      }

      abortRef.current = new AbortController();
      let researchRound = 0;
      const MAX_RESEARCH_ROUNDS = 4;

      while (researchRound <= MAX_RESEARCH_ROUNDS) {
        const apiMsgs = [
          { role: "system", content: buildSystem() },
          ...currentMsgs.map(m => ({ role: m.role, content: m.content })),
        ];

        if (researchRound > 0) {
          setResearchStatus(`Researching... (round ${researchRound})`);
        }

        const { data, usedModel } = await callAI(apiMsgs, key, groqKey);
        if (data.usage) setUsage(p => ({ i: p.i + (data.usage.prompt_tokens || 0), o: p.o + (data.usage.completion_tokens || 0) }));

        const rawContent = typeof data.choices?.[0]?.message?.content === "string"
          ? data.choices[0].message.content
          : Array.isArray(data.choices?.[0]?.message?.content)
            ? data.choices[0].message.content.filter(p => p?.type === "text").map(p => p.text).join("\n")
            : "";

        const { text, actions } = parseResponse(rawContent);

        // Handle memory update — show in chat and save to file
        if (actions.memoryUpdate) {
          setMem(actions.memoryUpdate);
          setMemDraft(actions.memoryUpdate);
          saveVal("meow-memory", actions.memoryUpdate);
          // Add a visible memory update note in chat
          const memNote = { role: "assistant", content: text + `\n\n---\n*Memory updated and saved to memory.txt*` };
          if (text) {
            currentMsgs = [...currentMsgs, memNote];
          }
        } else if (text) {
          currentMsgs = [...currentMsgs, { role: "assistant", content: text }];
        }

        setMsgs([...currentMsgs]);
        saveChat(currentMsgs);

        // Handle open browser commands
        for (const url of actions.openUrls) {
          openBrowserPopup(url);
        }

        // Check if AI requested research (searches or page reads)
        if ((actions.searches.length > 0 || actions.readUrls.length > 0) && researchRound < MAX_RESEARCH_ROUNDS) {
          researchRound++;
          let researchContext = "";

          // Execute searches
          for (const query of actions.searches) {
            setResearchStatus(`Searching: "${query}"...`);
            setSearchQuery(query);
            const results = await doSearch(query);
            if (results.length > 0) {
              researchContext += `\n\n<search_results query="${query}">\n`;
              results.forEach((r, idx) => {
                researchContext += `${idx + 1}. [${r.title}](${r.url})\n   ${r.snippet}\n`;
              });
              researchContext += `</search_results>`;
            } else {
              researchContext += `\n\n<search_results query="${query}">No results found.</search_results>`;
            }
          }

          // Fetch pages
          for (const url of actions.readUrls) {
            setResearchStatus(`Reading: ${url.slice(0, 50)}...`);
            const pageText = await fetchPageText(url);
            if (pageText) {
              researchContext += `\n\n<page_content url="${url}">\n${pageText}\n</page_content>`;
            } else {
              researchContext += `\n\n<page_content url="${url}">Could not fetch page content.</page_content>`;
            }
          }

          // Feed research results back as a system-like user message
          currentMsgs = [...currentMsgs, {
            role: "user",
            content: `[SYSTEM: Research results from your web search/page read requests]${researchContext}\n\nNow please provide a comprehensive answer using these research results. Cite sources with URLs. If you need more information, you can search again.`
          }];
          setMsgs([...currentMsgs]);

          continue; // Loop back for AI to process research results
        }

        // ─── Browser Agent Actions ───
        if (actions.browserActions.length > 0 && researchRound < MAX_RESEARCH_ROUNDS) {
          researchRound++;
          let browserContext = "";

          // Ensure popup is open and ready
          if (!agentBrowser.isOpen()) {
            agentBrowser.open();
          } else {
            agentBrowser.focus();
          }
          await agentBrowser.waitForReady();

          for (const action of actions.browserActions) {
            if (action.type === "navigate") {
              setResearchStatus(`Browser: navigating to ${action.url.slice(0, 40)}...`);
              const navResult = await agentBrowser.navigate(action.url);
              browserContext += `\n\n<browser_result action="navigate">Navigated to ${action.url}. Current URL: ${agentBrowser.currentUrl || action.url}${navResult && !navResult.success ? " (Error: " + navResult.error + ")" : ""}</browser_result>`;
            } else if (action.type === "click") {
              setResearchStatus(`Browser: clicking "${action.selector}"...`);
              const res = await agentBrowser.click(action.selector);
              if (res?.success) {
                browserContext += `\n\n<browser_result action="click">Clicked "${action.selector}" — element: ${res.element || ""}, text: "${res.text || ""}"</browser_result>`;
                await new Promise(r => setTimeout(r, 1200));
              } else {
                browserContext += `\n\n<browser_result action="click" error="true">Could not click "${action.selector}": ${res?.error || "not found"}</browser_result>`;
              }
            } else if (action.type === "type") {
              setResearchStatus(`Browser: typing into "${action.selector}"...`);
              const res = await agentBrowser.type(action.selector, action.text);
              if (res?.success) {
                browserContext += `\n\n<browser_result action="type">Typed "${action.text}" into "${action.selector}"</browser_result>`;
              } else {
                browserContext += `\n\n<browser_result action="type" error="true">Could not type into "${action.selector}": ${res?.error || "not found"}</browser_result>`;
              }
            } else if (action.type === "read") {
              setResearchStatus(`Browser: reading page...`);
              const res = await agentBrowser.read();
              if (res) {
                const linksStr = (res.links || []).slice(0, 10).map(l => `  - ${l.text}: ${l.href}`).join("\n");
                const inputsStr = (res.inputs || []).slice(0, 10).map(inp => `  - ${inp.tag}[${inp.placeholder || inp.name || inp.type || ""}]${inp.text ? " \"" + inp.text + "\"" : ""}`).join("\n");
                browserContext += `\n\n<browser_page title="${res.title || ""}" url="${agentBrowser.currentUrl}">\n${res.text || "(no text)"}\n\nLinks on page:\n${linksStr || "  (none)"}\n\nForm inputs:\n${inputsStr || "  (none)"}\n</browser_page>`;
              } else {
                browserContext += `\n\n<browser_result action="read" error="true">Could not read page (popup may be closed or page still loading)</browser_result>`;
              }
            } else if (action.type === "scroll") {
              setResearchStatus(`Browser: scrolling ${action.direction}...`);
              await agentBrowser.scroll(action.direction);
              await new Promise(r => setTimeout(r, 500));
              browserContext += `\n\n<browser_result action="scroll">Scrolled ${action.direction}</browser_result>`;
            } else if (action.type === "find") {
              setResearchStatus(`Browser: finding "${action.query}"...`);
              const res = await agentBrowser.find(action.query);
              if (res?.matches?.length > 0) {
                const matchStr = res.matches.map(m => `  - ${m.tag}[id="${m.id}"] "${m.text}"${m.href ? " href=" + m.href : ""}`).join("\n");
                browserContext += `\n\n<browser_result action="find">Found ${res.matches.length} element(s) matching "${action.query}":\n${matchStr}</browser_result>`;
              } else {
                browserContext += `\n\n<browser_result action="find">No elements found matching "${action.query}"</browser_result>`;
              }
            }
          }

          currentMsgs = [...currentMsgs, {
            role: "user",
            content: `[SYSTEM: Browser agent results]\nCurrent browser URL: ${agentBrowser.currentUrl || "(unknown)"}${browserContext}\n\nContinue your task. You can take more browser actions or provide your answer to the user.`
          }];
          setMsgs([...currentMsgs]);
          continue;
        }

        // No more research needed
        if (usedModel !== DEFAULT_MODEL) {
          setErr(`Primary model unavailable; used ${usedModel}.`);
        }
        break;
      }
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally {
      setBusy(false);
      setResearchStatus("");
      abortRef.current = null;
    }
  }, [input, msgs, busy, buildSystem, parseResponse, callAI, apiKey, groqApiKey, promptForApiKey, doSearch]);

  const clearChat = () => { setMsgs([]); saveChat([]); setSearchResults([]); setErr(null); };
  const ft = n => n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(1)+"K" : String(n);

  // ═══ RENDER ═══
  const S = {
    "--f": "'Nunito Sans', system-ui, sans-serif",
    "--m": "'JetBrains Mono', 'Consolas', monospace",
    "--bg": "#07070b", "--sf": "#0d0d14", "--bd": "#181824",
    "--tx": "#ccccda", "--dm": "#4e4e62", "--ac": "#7ce08a",
    "--ac2": "#88bbcc", "--dg": "#cc7777",
  };

  return (
    <div style={{ ...S, height: "100vh", display: "flex", fontFamily: "var(--f)", color: "var(--tx)", background: "var(--bg)", overflow: "hidden", fontSize: "13.5px" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ═══ LEFT SIDEBAR ═══ */}
      {sidebarOpen && (
        <div style={{ width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--bd)", background: "var(--sf)", overflow: "hidden", animation: "slideR .2s ease" }}>

          {/* Sidebar Header */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg,#7ce08a,#88bbcc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>🧠</div>
              <span style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "-0.2px" }}>Internet Browser</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", color: "var(--dm)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>

          {/* Sidebar Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--bd)" }}>
            <button
              onClick={() => setSidebarTab("browser")}
              style={{ flex: 1, padding: "8px", background: sidebarTab === "browser" ? "rgba(136,187,204,0.08)" : "transparent", border: "none", borderBottom: sidebarTab === "browser" ? "2px solid var(--ac2)" : "2px solid transparent", color: sidebarTab === "browser" ? "var(--ac2)" : "var(--dm)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--m)", fontWeight: 600 }}
            >Search & Browse</button>
            <button
              onClick={() => setSidebarTab("memory")}
              style={{ flex: 1, padding: "8px", background: sidebarTab === "memory" ? "rgba(124,224,138,0.08)" : "transparent", border: "none", borderBottom: sidebarTab === "memory" ? "2px solid var(--ac)" : "2px solid transparent", color: sidebarTab === "memory" ? "var(--ac)" : "var(--dm)", cursor: "pointer", fontSize: "11px", fontFamily: "var(--m)", fontWeight: 600 }}
            >Memory</button>
          </div>

          {/* ─── Browser / Search Tab ─── */}
          {sidebarTab === "browser" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Agent Browser Status */}
              <div style={{ padding: "7px 10px", borderBottom: "1px solid var(--bd)", background: isBrowserOpen() ? "rgba(124,224,138,0.04)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "5px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isBrowserOpen() ? (agentUserTookOver ? "#cc7777" : "#7ce08a") : "#444", display: "inline-block", flexShrink: 0 }}></span>
                    <span style={{ fontSize: "10px", fontFamily: "var(--m)", fontWeight: 700, color: isBrowserOpen() ? (agentUserTookOver ? "#cc7777" : "#7ce08a") : "#555" }}>
                      {isBrowserOpen() ? (agentUserTookOver ? "USER CONTROL" : "AI AGENT ACTIVE") : "BROWSER CLOSED"}
                    </span>
                  </div>
                  <button
                    onClick={() => { agentBrowser.open(); setAgentUserTookOver(false); }}
                    style={{ ...btn(isBrowserOpen() ? "#7ce08a" : "#88bbcc"), fontSize: "9px", padding: "2px 7px" }}
                  >{isBrowserOpen() ? "Focus" : "Open Browser"}</button>
                </div>
                {agentBrowserUrl && (
                  <div style={{ fontSize: "9px", fontFamily: "var(--m)", color: "#445", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={agentBrowserUrl}>
                    {agentBrowserUrl.slice(0, 50)}{agentBrowserUrl.length > 50 ? "…" : ""}
                  </div>
                )}
              </div>
              {/* URL Bar */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                  <input
                    value={browserUrl}
                    onChange={e => setBrowserUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBrowserGo(); }}
                    placeholder="Enter URL to open in agent browser..."
                    style={{ flex: 1, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bd)", borderRadius: "5px", color: "var(--tx)", fontSize: "11px", fontFamily: "var(--m)", outline: "none" }}
                  />
                  <button onClick={handleBrowserGo} style={btn("#88bbcc")} title="Open in agent browser">Go</button>
                </div>
                <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "4px" }}>
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search the web..."
                    style={{ flex: 1, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bd)", borderRadius: "5px", color: "var(--tx)", fontSize: "11px", fontFamily: "var(--m)", outline: "none" }}
                  />
                  <button type="submit" disabled={searchBusy} style={{ ...btn("#7ce08a"), opacity: searchBusy ? 0.5 : 1 }}>
                    {searchBusy ? "..." : "Search"}
                  </button>
                </form>
              </div>

              {/* Search Results */}
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {searchBusy && (
                  <div style={{ color: "var(--dm)", fontSize: "11px", padding: "8px 0", fontFamily: "var(--m)" }}>
                    Searching...
                  </div>
                )}
                {!searchBusy && searchResults.length === 0 && (
                  <div style={{ color: "var(--dm)", fontSize: "11px", padding: "12px 0", textAlign: "center", lineHeight: 1.8 }}>
                    Search the web or enter a URL above.<br/>
                    AI can also search autonomously during chat.
                  </div>
                )}
                {searchResults.map((r, i) => (
                  <div key={i} style={{ marginBottom: "10px", padding: "8px", background: "rgba(255,255,255,0.02)", borderRadius: "6px", border: "1px solid var(--bd)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener"
                        onClick={(e) => { e.preventDefault(); openBrowserPopup(r.url); }}
                        style={{ color: "var(--ac2)", fontSize: "11.5px", fontWeight: 600, textDecoration: "none", cursor: "pointer", flex: 1, lineHeight: 1.4 }}
                        title={r.url}
                      >
                        {r.title}
                      </a>
                      <button
                        onClick={() => openBrowserPopup(r.url)}
                        style={{ ...btn("#88bbcc"), padding: "2px 6px", fontSize: "9px", flexShrink: 0 }}
                        title="Open in popup"
                      >Open</button>
                    </div>
                    {r.snippet && (
                      <div style={{ fontSize: "10.5px", color: "var(--dm)", marginTop: "4px", lineHeight: 1.5 }}>
                        {r.snippet.slice(0, 150)}{r.snippet.length > 150 ? "..." : ""}
                      </div>
                    )}
                    <div style={{ fontSize: "9px", color: "#335", marginTop: "3px", fontFamily: "var(--m)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.url.slice(0, 60)}{r.url.length > 60 ? "..." : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Memory Tab ─── */}
          {sidebarTab === "memory" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <textarea
                value={memDraft}
                onChange={e => setMemDraft(e.target.value)}
                placeholder="Meow's persistent memory (memory.txt)...\nTell Meow to remember things, or type here directly.\nMemory is saved to file and shown in chat when updated."
                style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", color: "var(--tx)", fontSize: "12px", fontFamily: "var(--m)", resize: "none", outline: "none", lineHeight: 1.6 }}
              />
              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--bd)", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                <button onClick={saveMem} style={btn("#7ce08a")}>Save</button>
                <button onClick={downloadMem} style={btn("#88bbcc")}>Download .txt</button>
                <button onClick={uploadMem} style={btn("#88bbcc")}>Upload</button>
                <button onClick={() => { setMemDraft(""); setMem(""); saveVal("meow-memory", ""); }} style={btn("#cc7777")}>Clear</button>
              </div>
              <div style={{ padding: "6px 12px 8px", fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>
                {mem.length} chars · ~{Math.ceil(mem.length / 3.8)} tokens · Saved to memory.txt
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ MAIN COLUMN ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid var(--bd)", background: "rgba(13,13,20,0.9)", backdropFilter: "blur(14px)", flexShrink: 0, zIndex: 10, gap: "6px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "linear-gradient(135deg,#7ce08a,#88bbcc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>🐱</div>
            <span style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "-0.4px" }}>Meow</span>
            <span style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>OpenRouter · StepFun 2.5 Flash (free)</span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => promptForApiKey("Set or update your OpenRouter API key:")}
              style={{ ...hdr(), fontSize: "10px", fontFamily: "var(--m)", color: apiKey ? "var(--ac)" : "var(--dg)", borderColor: apiKey ? "rgba(124,224,138,0.2)" : "rgba(204,119,119,0.2)" }}
              title={apiKey ? "OpenRouter API key set" : "OpenRouter API key missing"}
            >
              {apiKey ? "OR ✓" : "OR !"}
            </button>
            <button
              onClick={() => promptForGroqKey("Set or update your Groq API key:")}
              style={{ ...hdr(), fontSize: "10px", fontFamily: "var(--m)", color: groqApiKey ? "var(--ac2)" : "var(--dm)", borderColor: groqApiKey ? "rgba(136,187,204,0.2)" : undefined }}
              title={groqApiKey ? "Groq API key set" : "Groq API key not set (optional fallback)"}
            >
              {groqApiKey ? "GROQ ✓" : "GROQ"}
            </button>
            <span style={{ fontSize: "9px", color: "var(--dm)", fontFamily: "var(--m)", padding: "2px 6px", background: "rgba(255,255,255,0.02)", borderRadius: "3px" }}>↑{ft(usage.i)} ↓{ft(usage.o)}</span>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ ...hdr(), background: sidebarOpen ? "rgba(136,187,204,0.08)" : undefined, color: sidebarOpen ? "var(--ac2)" : undefined, borderColor: sidebarOpen ? "rgba(136,187,204,0.15)" : undefined, display: "flex", alignItems: "center", gap: "4px" }}
              title="Internet Browser & Memory Panel"
            >
              <span style={{ fontSize: "13px" }}>🧠</span>
              <span style={{ fontSize: "10px", fontFamily: "var(--m)" }}>Browser</span>
            </button>
            <button onClick={clearChat} style={{ ...hdr(), fontSize: "10px", fontFamily: "var(--m)" }}>Clear</button>
          </div>
        </header>

        {/* CHAT AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, padding: "14px" }}>
            {msgs.length === 0 && !busy && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.45, gap: "10px", padding: "20px" }}>
                <div style={{ fontSize: "40px" }}>🐱</div>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>Meow</div>
                <div style={{ fontSize: "12px", color: "var(--dm)", textAlign: "center", maxWidth: "360px", lineHeight: 1.6 }}>
                  AI agent with persistent memory, web search, and a visual browser it can control.<br/>
                  Ask it to browse, click, fill forms — or open the sidebar to control the browser yourself.
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {msgs.map((m, i) => {
                // Hide system research messages from display
                if (m.role === "user" && m.content.startsWith("[SYSTEM: Research results")) {
                  return (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(136,187,204,0.05)", border: "1px solid rgba(136,187,204,0.1)", borderRadius: "8px", fontSize: "11px", color: "var(--ac2)", fontFamily: "var(--m)" }}>
                      Research data received — AI processing results...
                    </div>
                  );
                }
                if (m.role === "user" && m.content.startsWith("[SYSTEM: Browser agent results]")) {
                  return (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(124,224,138,0.05)", border: "1px solid rgba(124,224,138,0.12)", borderRadius: "8px", fontSize: "11px", color: "var(--ac)", fontFamily: "var(--m)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "9px" }}>●</span> Browser action results received — AI continuing task...
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "min(720px,94%)", background: m.role === "user" ? "rgba(124,224,138,0.08)" : "rgba(255,255,255,0.02)", border: "1px solid var(--bd)", borderRadius: "10px", padding: "10px 12px" }}>
                    {m.role === "assistant" ? <Md text={m.content} /> : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.content}</div>}
                  </div>
                );
              })}
              {busy && (
                <div style={{ opacity: .6, fontSize: "12px", padding: "6px 2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ animation: "bounce 1s infinite" }}>Thinking…</span>
                  {researchStatus && <span style={{ color: "var(--ac2)", fontFamily: "var(--m)", fontSize: "10px" }}>{researchStatus}</span>}
                </div>
              )}
              {err && <div style={{ color: "#f88", fontSize: "12px", padding: "6px 2px" }}>{err}</div>}
              <div ref={scrollRef} />
            </div>
          </div>

          {/* INPUT */}
          <div style={{ padding: "10px", borderTop: "1px solid var(--bd)", background: "rgba(13,13,20,0.7)" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Type a message... (Meow can search the web for you!)"
              style={{ width: "100%", minHeight: "44px", maxHeight: "180px", resize: "vertical", borderRadius: "8px", border: "1px solid var(--bd)", background: "rgba(255,255,255,0.02)", color: "var(--tx)", padding: "10px 12px", fontFamily: "var(--f)", fontSize: "13px", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "7px" }}>
              <span style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>
                {msgs.filter(m => !(m.role === "user" && m.content.startsWith("[SYSTEM:"))).length} msgs
                {isBrowserOpen() && <span style={{ color: agentUserTookOver ? "var(--dg)" : "var(--ac)", marginLeft: "8px" }}>
                  {agentUserTookOver ? "browser: user control" : "browser: AI agent active"}
                </span>}
              </span>
              <button onClick={send} disabled={busy || !input.trim()} style={{ ...btn("#7ce08a"), opacity: busy || !input.trim() ? .5 : 1 }}>Send</button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideR { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideL { from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        *{box-sizing:border-box;margin:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:2px}
        textarea::placeholder{color:#333}
        button:hover{filter:brightness(1.12)}
        input::placeholder{color:#333}
      `}</style>
    </div>
  );
}

function btn(c) {
  return { padding: "4px 10px", fontSize: "10px", borderRadius: "5px", border: `1px solid ${c}33`, background: `${c}0a`, color: c, cursor: "pointer", fontFamily: "var(--m)", fontWeight: 500 };
}
function hdr() {
  return { padding: "4px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bd)", borderRadius: "5px", color: "var(--dm)", fontSize: "12px", cursor: "pointer" };
}

ReactDOM.createRoot(document.getElementById("root")).render(<Meow />);
