const { useState, useEffect, useRef, useCallback } = React;

const API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "stepfun/step-3.5-flash:free";
const MODEL_FALLBACKS = [
  DEFAULT_MODEL,
  "qwen/qwen3-coder:free",
];
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "qwen/qwen3-32b";
const CORS_PROXIES = [
  { base: "https://api.allorigins.win/raw?url=", encode: true },
  { base: "https://api.codetabs.com/v1/proxy?quest=", encode: true },
  { base: "https://corsproxy.io/?url=", encode: true },
  { base: "https://thingproxy.freeboard.io/fetch/", encode: false },
  { base: "https://api.cors.lol/?url=", encode: true },
  { base: "https://corsproxy.org/?", encode: true },
];

// ─── Persistent Storage ───
async function loadVal(key) {
  try { const r = await window.storage.get(key); return r?.value || ""; } catch { return ""; }
}
async function saveVal(key, val) {
  try { await window.storage.set(key, val); } catch {}
}
async function loadChat() {
  try { const r = await window.storage.get("meow-chat"); const parsed = r ? JSON.parse(r.value) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
async function saveChat(msgs) {
  // Only save user/assistant messages, skip system research messages, cap at 40
  const toSave = msgs.filter(m => !(m.role === "user" && typeof m.content === "string" && m.content.startsWith("[SYSTEM:"))).slice(-40);
  try { await window.storage.set("meow-chat", JSON.stringify(toSave)); } catch {}
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

// ─── Race multiple CORS proxies for a URL — returns first successful text ───
async function fetchWithProxyRace(targetUrl, timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const controllers = CORS_PROXIES.map(() => new AbortController());
    let pending = CORS_PROXIES.length;

    // Global timeout: if nothing resolves in time, return null
    const globalTid = setTimeout(() => {
      if (!settled) {
        settled = true;
        controllers.forEach(c => { try { c.abort(); } catch {} });
        resolve(null);
      }
    }, timeoutMs + 2000);

    function onDone(html) {
      if (settled) return;
      // Reject empty or too-short responses (likely proxy error pages)
      if (!html || html.length < 50) { onFail(); return; }
      settled = true;
      clearTimeout(globalTid);
      controllers.forEach(c => { try { c.abort(); } catch {} });
      resolve(html);
    }
    function onFail() {
      if (settled) return;
      pending--;
      if (pending <= 0) { settled = true; clearTimeout(globalTid); resolve(null); }
    }

    CORS_PROXIES.forEach((proxy, i) => {
      const tid = setTimeout(() => { try { controllers[i].abort(); } catch {} }, timeoutMs);
      const proxyUrl = proxy.base + (proxy.encode ? encodeURIComponent(targetUrl) : targetUrl);
      fetch(proxyUrl, { signal: controllers[i].signal, cache: "no-store" })
        .then(r => { clearTimeout(tid); if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
        .then(html => { onDone(html); })
        .catch(() => { clearTimeout(tid); onFail(); });
    });
  });
}

// ─── Web Search via DuckDuckGo ───
async function performSearch(query) {
  const results = [];

  // Primary: DuckDuckGo HTML via CORS proxy race (real search results)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const html = await fetchWithProxyRace(ddgUrl, 15000);
    if (html) {
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
  } catch (e) {
    // AbortError is expected when proxy race times out — don't spam console
    if (e?.name !== "AbortError") console.warn("DDG HTML search failed:", e);
  }

  // Fallback 2: Google search via CORS proxy
  if (results.length === 0) {
    try {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;
      const gHtml = await fetchWithProxyRace(googleUrl, 12000);
      if (gHtml) {
        const gDoc = new DOMParser().parseFromString(gHtml, "text/html");
        // Google wraps results in <div class="g"> blocks
        gDoc.querySelectorAll("div.g, div.tF2Cxc, div.MjjYud div[data-hveid]").forEach(item => {
          const a = item.querySelector("a[href^='http']");
          const h3 = item.querySelector("h3");
          const snip = item.querySelector(".VwiC3b, .IsZvec, .s3v9rd, span.st");
          if (a && h3) {
            const href = a.getAttribute("href") || "";
            if (href.startsWith("http") && !href.includes("google.com/search")) {
              results.push({
                title: h3.textContent.trim(),
                snippet: snip?.textContent?.trim() || "",
                url: href,
              });
            }
          }
        });
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("Google search failed:", e);
    }
  }

  // Fallback 3: Brave Search via CORS proxy
  if (results.length === 0) {
    try {
      const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}&source=web`;
      const bHtml = await fetchWithProxyRace(braveUrl, 12000);
      if (bHtml) {
        const bDoc = new DOMParser().parseFromString(bHtml, "text/html");
        bDoc.querySelectorAll("#results .snippet, .result").forEach(item => {
          const a = item.querySelector("a[href^='http']");
          const title = item.querySelector(".snippet-title, .title, h2, h3");
          const snip = item.querySelector(".snippet-description, .snippet-content, .description");
          if (a && title) {
            const href = a.getAttribute("href") || "";
            if (href.startsWith("http") && !href.includes("brave.com")) {
              results.push({
                title: title.textContent.trim(),
                snippet: snip?.textContent?.trim() || "",
                url: href,
              });
            }
          }
        });
      }
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("Brave search failed:", e);
    }
  }

  // Fallback 4: DuckDuckGo JSON API (instant answers — no proxy needed, direct CORS)
  if (results.length === 0) {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const ctrl2 = new AbortController();
      const tid2 = setTimeout(() => ctrl2.abort(), 8000);
      const res = await fetch(url, { signal: ctrl2.signal });
      clearTimeout(tid2);
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

// ─── Fetch page text for AI reading (with fallbacks for dynamic sites) ───
async function fetchPageText(url) {
  // Helper to extract text from HTML string
  function extractText(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script,style,nav,footer,header,aside,iframe,noscript,svg").forEach(el => el.remove());
    return (doc.body?.textContent || "").replace(/\s+/g, " ").trim();
  }

  // 1. Try direct CORS proxy fetch
  try {
    const html = await fetchWithProxyRace(url, 12000);
    if (html) {
      const text = extractText(html);
      // If we got meaningful content (not just a SPA shell), return it
      if (text.length > 200) return text.slice(0, 6000);
    }
  } catch {}

  // 2. Fallback: Try Google Cache for pre-rendered version of dynamic sites
  try {
    const cacheUrl = "https://webcache.googleusercontent.com/search?q=cache:" + encodeURIComponent(url) + "&strip=1";
    const cacheHtml = await fetchWithProxyRace(cacheUrl, 10000);
    if (cacheHtml) {
      const text = extractText(cacheHtml);
      if (text.length > 100) return text.slice(0, 6000);
    }
  } catch {}

  // 3. Fallback: Try Wayback Machine for archived version
  try {
    const wbUrl = "https://web.archive.org/web/2/" + url;
    const wbHtml = await fetchWithProxyRace(wbUrl, 10000);
    if (wbHtml) {
      const text = extractText(wbHtml);
      if (text.length > 100) return text.slice(0, 6000);
    }
  } catch {}

  // 4. Fallback: Try 12ft.io for bypassing paywalls/JS requirements
  try {
    const ftUrl = "https://12ft.io/api/proxy?q=" + encodeURIComponent(url);
    const ftHtml = await fetchWithProxyRace(ftUrl, 10000);
    if (ftHtml) {
      const text = extractText(ftHtml);
      if (text.length > 100) return text.slice(0, 6000);
    }
  } catch {}

  return null;
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
      var selLower = sel.toLowerCase();
      try { el = document.querySelector(sel); } catch(ex) {}
      // Search clickable elements by textContent (handles nested text like <button><span>Try</span> Again</button>)
      if (!el) {
        var cands = document.querySelectorAll("a,button,input[type=submit],input[type=button],[onclick],[role=button],[role=link],summary,[tabindex]");
        for (var i = 0; i < cands.length; i++) { if ((cands[i].textContent || "").trim().toLowerCase().indexOf(selLower) >= 0) { el = cands[i]; break; } }
      }
      // Search by aria-label, title, value attributes
      if (!el) {
        var allAttr = document.querySelectorAll("[aria-label],[title],[value]");
        for (var i = 0; i < allAttr.length; i++) {
          var a = (allAttr[i].getAttribute("aria-label") || allAttr[i].getAttribute("title") || allAttr[i].getAttribute("value") || "").toLowerCase();
          if (a.indexOf(selLower) >= 0) { el = allAttr[i]; break; }
        }
      }
      // Search ANY element by textContent (not just leaf nodes — handles divs acting as buttons)
      if (!el) {
        var all = document.querySelectorAll("*");
        for (var i = 0; i < all.length; i++) {
          var txt = (all[i].textContent || "").trim().toLowerCase();
          // Prefer smaller/more specific elements: check if text closely matches
          if (txt === selLower || (txt.length < selLower.length * 3 && txt.indexOf(selLower) >= 0)) { el = all[i]; break; }
        }
      }
      // Last resort: partial match on any element
      if (!el) {
        var all2 = document.querySelectorAll("*");
        for (var i = 0; i < all2.length; i++) { if ((all2[i].textContent || "").trim().toLowerCase().indexOf(selLower) >= 0 && all2[i].offsetParent !== null) { el = all2[i]; break; } }
      }
      if (el) {
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch(ex) {}
        var rect = el.getBoundingClientRect();
        var prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
        el.style.outline = "2px solid #7ce08a"; el.style.outlineOffset = "2px";
        setTimeout(function() { try { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; } catch(ex){} }, 1400);
        // Try multiple click methods for better compatibility
        try { el.focus(); } catch(ex) {}
        try { el.click(); } catch(ex) {}
        try {
          el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        } catch(ex) {}
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
      // First search interactive elements
      var fEls = document.querySelectorAll("a,button,input,textarea,select,[onclick],[role=button],[role=link],summary,[tabindex],[aria-label]");
      var matches = [];
      for (var i = 0; i < fEls.length && matches.length < 15; i++) {
        var el = fEls[i];
        var t = ((el.textContent || "") + (el.id || "") + (el.name || "") + (el.placeholder || "") + (el.className || "") + (el.getAttribute("aria-label") || "") + (el.getAttribute("title") || "") + (el.getAttribute("value") || "")).toLowerCase();
        if (t.indexOf(q) >= 0) matches.push({ tag: el.tagName, id: el.id || "", text: (el.textContent || "").trim().slice(0, 50), href: el.href || "" });
      }
      // Also search all visible elements if not enough matches found
      if (matches.length < 5) {
        var allEls = document.querySelectorAll("div,span,p,h1,h2,h3,h4,h5,h6,li,td,th,label,section,article");
        for (var i = 0; i < allEls.length && matches.length < 15; i++) {
          var el = allEls[i];
          var txt = (el.textContent || "").trim().toLowerCase();
          if (txt.length < 200 && txt.indexOf(q) >= 0 && el.offsetParent !== null) {
            var already = false;
            for (var j = 0; j < matches.length; j++) { if (matches[j].text === (el.textContent || "").trim().slice(0, 50)) { already = true; break; } }
            if (!already) matches.push({ tag: el.tagName, id: el.id || "", text: (el.textContent || "").trim().slice(0, 50), href: "" });
          }
        }
      }
      reply(e, id, { matches: matches });
    }
  });

  // Intercept link clicks so the popup can fetch and load the new page via proxy
  document.addEventListener("click", function(ev) {
    var el = ev.target;
    while (el && el.tagName !== "A") el = el.parentNode;
    if (!el || el.tagName !== "A") return;
    var href = el.href || "";
    if (!/^https?:\/\//i.test(href)) return;
    ev.preventDefault();
    ev.stopPropagation();
    try { window.parent.postMessage({ meowBrowser: true, type: "iframeNavigate", url: href }, "*"); } catch(ex) {}
  }, true);

  // Intercept form submissions
  document.addEventListener("submit", function(ev) {
    var form = ev.target;
    if (!form || form.tagName !== "FORM") return;
    var method = (form.method || "get").toLowerCase();
    if (method !== "get") return; // only intercept GET forms
    var action = form.action || window.location.href;
    if (!/^https?:\/\//i.test(action)) return;
    ev.preventDefault();
    var params = new URLSearchParams();
    var els = form.elements;
    for (var i = 0; i < els.length; i++) {
      if (els[i].name && !els[i].disabled && els[i].type !== "submit" && els[i].type !== "button") {
        params.set(els[i].name, els[i].value || "");
      }
    }
    var qs = params.toString();
    var url = action + (qs ? (action.indexOf("?") >= 0 ? "&" : "?") + qs : "");
    try { window.parent.postMessage({ meowBrowser: true, type: "iframeNavigate", url: url }, "*"); } catch(ex) {}
  }, true);
}

// ─── Popup window script (runs in popup, serialized via .toString()) ───
function _popupScript(cfg) {
  var PROXY = cfg.proxy;
  var IFRAME_CTRL = cfg.iframeCtrl;
  var iframe, urlInput, loadingOverlay, loadingText, agentLog, statusText, statusMode, agentBadge, agentBadgeText, takeoverBtn, clickIndicator, agentPanel, panelToggle;
  var currentUrl = "", agentMode = true, directMode = false, navHistory = [], histIdx = -1, panelCollapsed = false;

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
    document.getElementById("dm").onclick = toggleDirect;
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
    var safeType = (type || "").replace(/[^a-zA-Z0-9_-]/g, "");
    d.className = "le " + safeType;
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

    // ─── Direct mode: load URL directly in iframe (full JS support) ───
    if (directMode) {
      showLoading(url);
      addLog("Direct navigate: " + url.slice(0, 65), "nav");
      var dtid = setTimeout(function() {
        iframe.onload = null;
        hideLoading();
        addLog("Direct load complete (or timed out)", "nav");
        updateUrl(url);
        if (navHistory[histIdx] !== url) { navHistory = navHistory.slice(0, histIdx + 1); navHistory.push(url); histIdx = navHistory.length - 1; }
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: true, url: url, direct: true } });
      }, 12000);
      iframe.onload = function() {
        clearTimeout(dtid);
        hideLoading(); updateUrl(url);
        if (navHistory[histIdx] !== url) { navHistory = navHistory.slice(0, histIdx + 1); navHistory.push(url); histIdx = navHistory.length - 1; }
        addLog("Loaded (direct): " + url.slice(0, 55), "ok");
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: true, url: url, direct: true } });
      };
      iframe.removeAttribute("srcdoc");
      iframe.src = url;
      return;
    }

    // ─── Proxy mode: fetch via CORS proxy and inject into iframe ───
    showLoading(url);
    addLog("Navigate: " + url.slice(0, 65), "nav");
    var rawProxies = (cfg.proxies && cfg.proxies.length) ? cfg.proxies : [{ base: cfg.proxy, encode: true }];
    // Normalize: support both string and {base, encode} formats
    var proxies = rawProxies.map(function(p) { return typeof p === "string" ? { base: p, encode: true } : p; });

    // Race all proxies in parallel — use the first successful response
    var settled = false;
    var controllers = proxies.map(function() { return new AbortController(); });
    var pending = proxies.length;
    var lastErr = new Error("All CORS proxies failed");

    function onSuccess(html) {
      if (settled) return;
      // Reject empty or too-short responses (likely proxy error pages)
      if (!html || html.length < 50) { onFail(new Error("Empty response")); return; }
      settled = true;
      clearTimeout(navTimeout);
      // Cancel remaining requests
      controllers.forEach(function(c) { try { c.abort(); } catch(e) {} });
      html = fixBase(html, url);
      html = injectCtrl(html);
      // Use srcdoc to avoid "Not allowed to load local resource: blob:..." sandbox error
      var ltid = setTimeout(function() {
        iframe.onload = null;
        hideLoading();
        addLog("Timeout — page did not load in time", "err");
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: false, error: "Page load timeout" } });
      }, 10000);
      iframe.onload = function() {
        clearTimeout(ltid);
        hideLoading(); updateUrl(url);
        if (navHistory[histIdx] !== url) { navHistory = navHistory.slice(0, histIdx + 1); navHistory.push(url); histIdx = navHistory.length - 1; }
        addLog("Loaded: " + url.slice(0, 55), "ok");
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: true, url: url } });
      };
      iframe.srcdoc = html;
    }

    function onFail(err) {
      if (settled) return;
      if (err && err.name !== "AbortError") lastErr = err;
      pending--;
      if (pending > 0) return; // still waiting for other proxies
      settled = true;
      clearTimeout(navTimeout);
      var msg = lastErr.name === "AbortError" ? "Request timed out" : (lastErr.message || "Unknown error");
      hideLoading(); addLog("Error: " + msg, "err");
      var errHtml = "<!DOCTYPE html><html><body style='background:#07070b;color:#cc7777;font-family:monospace;padding:30px;font-size:13px'>"
        + "<h2 style='margin:0 0 10px;color:#e88'>Failed to load page</h2>"
        + "<p style='color:#888;word-break:break-all;margin-bottom:8px'>" + esc(url) + "</p>"
        + "<p style='color:#cc7777'>" + esc(msg) + "</p>"
        + "<p style='color:#555;margin-top:12px;font-size:11px'>All CORS proxies failed. This site may block proxy access or require JavaScript to render.</p>"
        + "</body></html>";
      iframe.onload = null;
      iframe.srcdoc = errHtml;
      if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: false, error: msg } });
    }

    // Overall navigation timeout (prevents indefinite loading state)
    var navTimeout = setTimeout(function() {
      if (!settled) {
        settled = true;
        controllers.forEach(function(c) { try { c.abort(); } catch(e) {} });
        hideLoading();
        addLog("Navigation timeout — site may be too heavy or blocked", "err");
        var errHtml = "<!DOCTYPE html><html><body style='background:#07070b;color:#cc7777;font-family:monospace;padding:30px;font-size:13px'>"
          + "<h2 style='margin:0 0 10px;color:#e88'>Page load timed out</h2>"
          + "<p style='color:#888;word-break:break-all;margin-bottom:8px'>" + esc(url) + "</p>"
          + "<p style='color:#cc7777'>The page took too long to load through CORS proxies. Heavy or JavaScript-dependent sites may not load.</p>"
          + "<p style='color:#555;margin-top:12px;font-size:11px'>Try a simpler page or a different URL.</p>"
          + "</body></html>";
        iframe.onload = null;
        iframe.srcdoc = errHtml;
        if (replyId != null) notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: replyId, payload: { success: false, error: "Navigation timeout" } });
      }
    }, 25000);

    proxies.forEach(function(proxy, i) {
      var tid = setTimeout(function() { try { controllers[i].abort(); } catch(e) {} }, 10000);
      var proxyUrl = proxy.base + (proxy.encode ? encodeURIComponent(url) : url);
      fetch(proxyUrl, { signal: controllers[i].signal, cache: "no-store" })
        .then(function(r) {
          clearTimeout(tid);
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function(html) { onSuccess(html); })
        .catch(function(e) { clearTimeout(tid); onFail(e); });
    });
  }

  function fixBase(html, url) {
    try {
      var u = new URL(url);
      var base = u.origin + u.pathname.split("/").slice(0, -1).join("/") + "/";
      var tag = "<base href=\"" + base + "\">";
      // Remove any existing <base> tags to avoid conflicts
      html = html.replace(/<base\s[^>]*>/gi, "");
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

  function toggleDirect() {
    directMode = !directMode;
    var dmBtn = document.getElementById("dm");
    if (directMode) {
      dmBtn.textContent = "Direct \u2713";
      dmBtn.style.color = "#7ce08a";
      dmBtn.style.borderColor = "rgba(124,224,138,0.3)";
      dmBtn.style.background = "rgba(124,224,138,0.1)";
      addLog("Direct mode ON \u2014 pages load with full JavaScript support", "ok");
      addLog("Note: AI control (click/type) unavailable in direct mode", "nav");
    } else {
      dmBtn.textContent = "Direct";
      dmBtn.style.color = "#88bbcc";
      dmBtn.style.borderColor = "rgba(136,187,204,0.3)";
      dmBtn.style.background = "rgba(136,187,204,0.1)";
      addLog("Proxy mode \u2014 AI can interact with pages", "ok");
    }
    notifyParent("directModeChanged", { direct: directMode });
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
    // Handle navigation requests from iframe link clicks
    if (d.type === "iframeNavigate" && d.url) {
      addLog("Link click: " + d.url.slice(0, 60), "nav");
      navigateTo(d.url);
      return;
    }
    var id = d.id, data = d.data || {};
    if (d.cmd === "setDirectMode") {
      if (data.direct !== directMode) toggleDirect();
      return;
    }
    if (d.cmd === "navigate") { navigateTo(data.url, id); }
    else if (directMode && (d.cmd === "click" || d.cmd === "type" || d.cmd === "read" || d.cmd === "find" || d.cmd === "scroll")) {
      // In direct mode, AI control is unavailable — page is loaded directly
      var errPayload = { success: false, error: "Direct mode is active \u2014 AI interaction unavailable. The page is loaded with full JavaScript. Use <read_url> to extract text content, or switch to Proxy mode for AI control.", directMode: true };
      if (d.cmd === "read") {
        // For read, try to get at least the URL info
        errPayload.text = "(page loaded in direct mode \u2014 use read_url tag for text extraction)";
        errPayload.title = currentUrl;
      }
      notifyParent_raw({ meowBrowser: true, type: "cmdReply", id: id, payload: errPayload });
      addLog("AI " + d.cmd + " blocked \u2014 direct mode active", "err");
      return;
    }
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
  var popupScriptSrc = "(" + _popupScript.toString() + ")(" + JSON.stringify({ proxy: CORS_PROXIES[0].base, proxies: CORS_PROXIES, iframeCtrl: iframeCtrlSrc }) + ")";
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
    "#ap { background: rgba(7,7,11,0.98); border-top: 1px solid #181824; transition: max-height 0.25s; overflow: hidden; max-height: 170px; flex-shrink: 0; }",
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
    '  <button id="dm" style="padding:4px 10px;border-radius:5px;font-size:10px;background:rgba(136,187,204,0.1);border:1px solid rgba(136,187,204,0.3);color:#88bbcc;cursor:pointer;white-space:nowrap;font-weight:700" title="Direct mode: loads pages with full JavaScript (for dynamic sites like SPAs). AI control unavailable in this mode.">Direct</button>',
    '</div>',
    '<div id="content-area">',
    '  <iframe id="pf" sandbox="allow-scripts allow-forms allow-popups allow-same-origin allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>',
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
  var popup = null, currentUrl = "", agentMode = true, directMode = false;
  var pendingResolvers = {}, msgId = 0;
  var listenerAdded = false;
  var onUrlChangeCb = null, onUserTookOverCb = null, onPopupBlockedCb = null;
  var pendingInitUrl = null, isReady = false, readyResolvers = [];

  function initListener(onUrlChange, onUserTookOver, onPopupBlocked) {
    onUrlChangeCb = onUrlChange; onUserTookOverCb = onUserTookOver;
    if (onPopupBlocked) onPopupBlockedCb = onPopupBlocked;
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
      if (d.type === "directModeChanged") { directMode = !!(d.payload && d.payload.direct); }
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
      // Revoke blob URL after popup loads to prevent memory leak
      setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 5000);
      if (!popup || popup.closed) {
        popup = null;
        pendingInitUrl = null;
        if (onPopupBlockedCb) onPopupBlockedCb();
      }
    } else {
      if (url) _send("navigate", { url: url });
      popup.focus();
    }
  }

  function _send(cmd, data, waitForReply, customTimeout) {
    if (!isOpen()) return Promise.resolve(null);
    var id = ++msgId;
    popup.postMessage({ meowBrowser: true, id: id, cmd: cmd, data: data || {} }, "*");
    if (!waitForReply) return Promise.resolve(null);
    return new Promise(function(resolve) {
      pendingResolvers[id] = resolve;
      setTimeout(function() { if (pendingResolvers[id]) { delete pendingResolvers[id]; resolve(null); } }, customTimeout || 8000);
    });
  }

  return {
    get currentUrl() { return currentUrl; },
    get agentMode() { return agentMode; },
    get directMode() { return directMode; },
    initListener: initListener,
    isOpen: isOpen,
    open: open,
    setDirectMode: function(on) { _send("setDirectMode", { direct: !!on }); directMode = !!on; },
    navigate: function(url) { if (!isOpen()) { open(url); return Promise.resolve(null); } return _send("navigate", { url: url }, true, 22000); },
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
  try {
    const MAX_ELEMENTS = 2000;
    const els = [];
    const lines = String(text).split("\n");
    let i = 0, k = 0;
    while (i < lines.length && k < MAX_ELEMENTS) {
      const L = lines[i];
      // Guard: skip null/undefined lines
      if (L == null) { i++; continue; }
      // Code blocks
      if (L.trimStart().startsWith("```")) {
        const lang = L.trimStart().slice(3).trim();
        const cl = [];
        i++;
        while (i < lines.length && !(lines[i] != null && lines[i].trimStart().startsWith("```"))) {
          cl.push(lines[i] != null ? lines[i] : "");
          i++;
        }
        if (i < lines.length) i++;
        const code = cl.join("\n");
        els.push(<div key={k++} style={{ position: "relative", margin: "10px 0", borderRadius: "8px", overflow: "hidden", border: "1px solid #1d1d28" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", background: "#101018", fontSize: "10px", fontFamily: "var(--m)", color: "#555", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            <span>{lang || "code"}</span>
            <button onClick={() => { try { navigator.clipboard.writeText(code); } catch {} }} style={{ background: "none", border: "none", color: "#7a7", cursor: "pointer", fontSize: "10px", fontFamily: "var(--m)" }}>copy</button>
          </div>
          <pre style={{ margin: 0, padding: "12px", background: "#0a0a12", overflowX: "auto", fontSize: "12.5px", fontFamily: "var(--m)", lineHeight: 1.6, color: "#aed4a0", tabSize: 2 }}><code>{code}</code></pre>
        </div>);
        continue;
      }
      // Horizontal rule
      if (/^---+$/.test(L.trim())) { els.push(<hr key={k++} style={{ border: "none", borderTop: "1px solid #1d1d28", margin: "10px 0" }} />); i++; continue; }
      // Headings (check ### before ## before # to match correctly)
      if (L.startsWith("### ")) { els.push(<h4 key={k++} style={{ margin: "14px 0 4px", fontSize: "13px", fontWeight: 600, color: "#8bc" }}>{il(L.slice(4))}</h4>); }
      else if (L.startsWith("## ")) { els.push(<h3 key={k++} style={{ margin: "16px 0 5px", fontSize: "15px", fontWeight: 700, color: "#dde" }}>{il(L.slice(3))}</h3>); }
      else if (L.startsWith("# ")) { els.push(<h2 key={k++} style={{ margin: "18px 0 6px", fontSize: "17px", fontWeight: 700, color: "#eef" }}>{il(L.slice(2))}</h2>); }
      else if (L.startsWith("> ")) { els.push(<blockquote key={k++} style={{ margin: "8px 0", padding: "6px 12px", borderLeft: "3px solid #8bc", background: "rgba(136,187,204,0.04)", borderRadius: "0 6px 6px 0", color: "#99a" }}>{il(L.slice(2))}</blockquote>); }
      else if (/^[\-\*]\s/.test(L)) { els.push(<div key={k++} style={{ display: "flex", gap: "7px", margin: "2px 0", paddingLeft: "2px" }}><span style={{ color: "#7a7", flexShrink: 0, fontSize: "9px", marginTop: "3px" }}>●</span><span style={{ flex: 1 }}>{il(L.replace(/^[\-\*]\s/, ""))}</span></div>); }
      else if (/^\d+\.\s/.test(L)) {
        const m = L.match(/^(\d+)\.\s(.*)/);
        if (m) { els.push(<div key={k++} style={{ display: "flex", gap: "7px", margin: "2px 0", paddingLeft: "2px" }}><span style={{ color: "#8bc", flexShrink: 0, fontFamily: "var(--m)", fontSize: "12px", minWidth: "16px", textAlign: "right" }}>{m[1]}.</span><span style={{ flex: 1 }}>{il(m[2])}</span></div>); }
        else { els.push(<p key={k++} style={{ margin: "3px 0", lineHeight: 1.7 }}>{il(L)}</p>); }
      }
      else if (L.trim() === "") { els.push(<div key={k++} style={{ height: "8px" }} />); }
      else { els.push(<p key={k++} style={{ margin: "3px 0", lineHeight: 1.7 }}>{il(L)}</p>); }
      i++;
    }
    return <div>{els}</div>;
  } catch (err) {
    // Fallback: render as plain text if markdown parsing fails
    console.warn("Md render error:", err);
    return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{String(text)}</div>;
  }
}
function il(t) {
  if (typeof t !== "string") return t;
  try {
    const p = [];
    let i = 0, k = 0;
    const MAX_PARTS = 5000;
    const len = t.length;
    while (i < len && k < MAX_PARTS) {
      // Inline code
      if (t[i] === "`") {
        const e = t.indexOf("`", i + 1);
        if (e > i) { p.push(<code key={k++} style={{ background: "rgba(170,210,160,0.08)", color: "#aed4a0", padding: "1px 4px", borderRadius: "3px", fontSize: "0.88em", fontFamily: "var(--m)" }}>{t.slice(i + 1, e)}</code>); i = e + 1; continue; }
      }
      // Bold
      if (t[i] === "*" && t[i + 1] === "*") {
        const e = t.indexOf("**", i + 2);
        if (e > i) { p.push(<strong key={k++} style={{ color: "#e0e0ea", fontWeight: 600 }}>{t.slice(i + 2, e)}</strong>); i = e + 2; continue; }
      }
      // Italic (only if not bold)
      if (t[i] === "*" && t[i + 1] !== "*") {
        const e = t.indexOf("*", i + 1);
        if (e > i) { p.push(<em key={k++} style={{ color: "#888" }}>{t.slice(i + 1, e)}</em>); i = e + 1; continue; }
      }
      // Links
      if (t[i] === "[") {
        const cb = t.indexOf("](", i);
        const cp = cb > i ? t.indexOf(")", cb + 2) : -1;
        if (cb > i && cp > cb) { p.push(<a key={k++} href={t.slice(cb + 2, cp)} target="_blank" rel="noopener" style={{ color: "#8bc", textDecoration: "underline" }}>{t.slice(i + 1, cb)}</a>); i = cp + 1; continue; }
      }
      // Plain text — advance to next special char or end of string
      let j = i + 1;
      while (j < len && !"`*[".includes(t[j])) j++;
      p.push(t.slice(i, j));
      i = j;
    }
    return p;
  } catch (err) {
    console.warn("il render error:", err);
    return t;
  }
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
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [expression, setExpression] = useState("happy"); // "happy" | "serious"
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
      () => setAgentUserTookOver(true),
      () => setPopupBlocked(true)
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
    a.download = "meow-memory.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
You can search the internet and read web pages! You have a built-in research tool that searches the web without needing to open browser tabs or windows. When you need current information, facts, news, or want to research a topic:

1. **To search the web**: Include <web_search>your search query</web_search> in your response. This searches DuckDuckGo, Google, and Brave for comprehensive results.
2. **To read a webpage**: Include <read_url>https://example.com</read_url> in your response. This fetches and extracts text content from the page, with automatic fallbacks for dynamic sites (Google Cache, Wayback Machine).
3. **To open a page in the user's browser popup**: Include <open_browser>https://example.com</open_browser> in your response.

You should PROACTIVELY research when:
- The user asks about current events, news, or recent information
- You need to verify facts or find up-to-date data
- The user asks you to look something up or research a topic
- The topic involves recent developments, prices, statistics, etc.
- You want to provide accurate, up-to-date information on ANY topic

When researching, search multiple queries if needed. Cite sources with URLs. You can chain multiple <web_search> and <read_url> tags in a single response to gather information from multiple sources at once.

## AI Browser Agent Capability
You can DIRECTLY CONTROL a visual browser window! The user will see the browser popup and can take over at any time.

⚠️ CRITICAL FORMAT RULE: Use ONLY the exact XML tags listed below. Do NOT use \`<tool_call>\`, \`<function=...>\`, \`<parameter=...>\`, JSON tool syntax, or any other wrapper format. Output the tags DIRECTLY in your response text:

1. **Navigate**: <browser_navigate>https://example.com</browser_navigate>
2. **Click**: <browser_click>button text or CSS selector</browser_click>
3. **Type**: <browser_type>selector :: text to type</browser_type>
4. **Read page**: <browser_read/> — always use this after navigating to see the page!
5. **Scroll**: <browser_scroll>down</browser_scroll> (up/down/top/bottom)
6. **Find elements**: <browser_find>search text</browser_find>

**Correct example** — going to X.com:
I'll navigate to X.com now.
<browser_navigate>https://x.com</browser_navigate>
<browser_read/>

**Browser workflow**: Navigate → Read page → Click/type → Read again → Repeat as needed
- You can chain multiple browser actions in one response — they execute in sequence
- After browser actions you'll receive the results and can continue the task
- The user can click "Take Over" in the browser popup to control it themselves anytime

Use the browser agent for: filling forms, searching websites, web apps, booking, shopping, etc.

**Important**: The browser has two modes:
- **Proxy mode** (default): AI can control the page (click, type, read). Best for static sites and simple interactions.
- **Direct mode**: Pages load with full JavaScript support. Use this for dynamic sites (SPAs, React/Angular apps, etc.) but AI control is unavailable — the user browses manually. The user can toggle Direct mode in the browser toolbar.

If a page doesn't load properly in proxy mode, suggest the user enable "Direct" mode in the browser toolbar for full JavaScript support.

## Expressions
You have a visual avatar that shows your mood! Include an <expression> tag in EVERY response to set your expression:
- <expression>happy</expression> — use when greeting, helping, giving good news, being playful, or general conversation
- <expression>serious</expression> — use when thinking deeply, explaining complex topics, giving warnings, or discussing serious matters

Always include exactly ONE <expression> tag per response. Place it at the very START of your response, before any other text. Default to happy if unsure.`;


    return s;
  }, [mem]);

  // ─── Parse AI response (memory updates, search triggers, browser commands) ───
  const parseResponse = useCallback((text) => {
    // Safety: ensure we always work with a string
    if (!text || typeof text !== "string") return { text: String(text || ""), actions: { memoryUpdate: null, searches: [], readUrls: [], openUrls: [], browserActions: [], expression: null } };
    try {
    let cleaned = text;
    const actions = { memoryUpdate: null, searches: [], readUrls: [], openUrls: [], browserActions: [], expression: null };

    // Extract expression tag
    const exprMatch = cleaned.match(/<expression>([\s\S]*?)<\/expression>/);
    if (exprMatch) {
      const expr = exprMatch[1].trim().toLowerCase();
      if (expr === "serious" || expr === "happy") actions.expression = expr;
      else actions.expression = "happy"; // default to happy for unknown
      cleaned = cleaned.replace(/<expression>[\s\S]*?<\/expression>/g, "").trim();
    }

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

    // ─── Handle <tool_call> format (some models output this instead of plain XML tags) ───
    // <tool_call><function=browser_navigate><parameter=url>URL</parameter></function></tool_call>
    for (const m of cleaned.matchAll(/<tool_call>[\s\S]*?<function=browser_navigate>[\s\S]*?<parameter=[^>]*>([\s\S]*?)<\/parameter>[\s\S]*?<\/function>[\s\S]*?<\/tool_call>/g))
      actions.browserActions.push({ type: "navigate", url: m[1].trim() });
    for (const m of cleaned.matchAll(/<tool_call>[\s\S]*?<function=browser_click>[\s\S]*?<parameter=[^>]*>([\s\S]*?)<\/parameter>[\s\S]*?<\/function>[\s\S]*?<\/tool_call>/g))
      actions.browserActions.push({ type: "click", selector: m[1].trim() });
    for (const m of cleaned.matchAll(/<tool_call>[\s\S]*?<function=browser_scroll>[\s\S]*?<parameter=[^>]*>([\s\S]*?)<\/parameter>[\s\S]*?<\/function>[\s\S]*?<\/tool_call>/g))
      actions.browserActions.push({ type: "scroll", direction: m[1].trim() });
    for (const m of cleaned.matchAll(/<tool_call>[\s\S]*?<function=web_search>[\s\S]*?<parameter=[^>]*>([\s\S]*?)<\/parameter>[\s\S]*?<\/function>[\s\S]*?<\/tool_call>/g))
      actions.searches.push(m[1].trim());
    if (/<tool_call>[\s\S]*?<function=(?:browser_read|web_read)/.test(cleaned))
      actions.browserActions.push({ type: "read" });
    // Strip all remaining <tool_call> blocks from display text
    cleaned = cleaned.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();

    // Handle <web_read/> as alias for <browser_read/>
    if (/<web_read[\s\/]/.test(cleaned) || cleaned.includes("<web_read>"))
      actions.browserActions.push({ type: "read" });
    cleaned = cleaned.replace(/<web_read\s*\/?>/g, "").replace(/<web_read>[\s\S]*?<\/web_read>/g, "").trim();

    // Strip any stray <function=...> tags that weren't inside a <tool_call>
    cleaned = cleaned.replace(/<function=[^>]*>[\s\S]*?<\/function>/g, "").trim();

    return { text: cleaned, actions };
    } catch (err) {
      console.warn("parseResponse error:", err);
      return { text: String(text), actions: { memoryUpdate: null, searches: [], readUrls: [], openUrls: [], browserActions: [], expression: null } };
    }
  }, []);

  // ─── Call AI API ───
  const callAI = useCallback(async (apiMsgs, key, groqKey) => {
    const buildBody = (model) => ({ model, messages: apiMsgs });
    let data = null;
    let usedModel = DEFAULT_MODEL;
    let lastErr = null;
    const delay = ms => new Promise(r => setTimeout(r, ms));

    // Try OpenRouter with 429 retry
    if (key) {
      for (const model of MODEL_FALLBACKS) {
        const MAX_RETRIES = 3;
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
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

          // Retry on 429 (rate limit) with exponential backoff
          if (res.status === 429 && attempt < MAX_RETRIES - 1) {
            await delay(1500 * (attempt + 1));
            continue;
          }

          // Non-retryable error — break inner retry loop, outer loop tries next model
          break;
        }
        if (data) break;
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
      const MAX_RESEARCH_ROUNDS = 10;
      const MAX_MSGS = 80;

      while (researchRound <= MAX_RESEARCH_ROUNDS) {
        // Trim messages to prevent unbounded context growth
        if (currentMsgs.length > MAX_MSGS) {
          currentMsgs = currentMsgs.slice(-MAX_MSGS);
        }
        const apiMsgs = [
          { role: "system", content: buildSystem() },
          ...currentMsgs.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content.slice(0, 12000) : m.content })),
        ];

        if (researchRound > 0) {
          setResearchStatus(`Researching... (round ${researchRound})`);
          // Pace API calls to avoid 429 rate limits
          await new Promise(r => setTimeout(r, 800));
        }

        const { data, usedModel } = await callAI(apiMsgs, key, groqKey);
        if (data.usage) setUsage(p => ({ i: p.i + (data.usage.prompt_tokens || 0), o: p.o + (data.usage.completion_tokens || 0) }));

        let rawContent = typeof data.choices?.[0]?.message?.content === "string"
          ? data.choices[0].message.content
          : Array.isArray(data.choices?.[0]?.message?.content)
            ? data.choices[0].message.content.filter(p => p?.type === "text").map(p => p.text).join("\n")
            : "";
        // Strip <think>...</think> blocks some models emit
        rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

        const { text, actions } = parseResponse(rawContent);

        // Handle expression update
        if (actions.expression) {
          setExpression(actions.expression);
        }

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
          // Deduplicate: keep only the first 'read' action to avoid redundant page reads
          let seenRead = false;
          const dedupedActions = actions.browserActions.filter(a => {
            if (a.type === "read") { if (seenRead) return false; seenRead = true; }
            return true;
          });

          // Ensure popup is open and ready
          if (!agentBrowser.isOpen()) {
            agentBrowser.open();
          } else {
            agentBrowser.focus();
          }
          await agentBrowser.waitForReady();

          for (const action of dedupedActions) {
            if (action.type === "navigate") {
              setResearchStatus(`Browser: navigating to ${action.url.slice(0, 40)}...`);
              const navResult = await agentBrowser.navigate(action.url);
              // Give page time to render after navigation
              await new Promise(r => setTimeout(r, 800));
              browserContext += `\n\n<browser_result action="navigate">Navigated to ${action.url}. Current URL: ${agentBrowser.currentUrl || action.url}${navResult && !navResult.success ? " (Error: " + navResult.error + ")" : ""}</browser_result>`;
            } else if (action.type === "click") {
              setResearchStatus(`Browser: clicking "${action.selector}"...`);
              const res = await agentBrowser.click(action.selector);
              if (res?.success) {
                browserContext += `\n\n<browser_result action="click">Clicked "${action.selector}" — element: ${res.element || ""}, text: "${res.text || ""}"</browser_result>`;
                await new Promise(r => setTimeout(r, 400));
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
              await new Promise(r => setTimeout(r, 100));
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
                    onClick={() => { setPopupBlocked(false); agentBrowser.open(); setAgentUserTookOver(false); }}
                    style={{ ...btn(popupBlocked ? "#cc7777" : isBrowserOpen() ? "#7ce08a" : "#88bbcc"), fontSize: "9px", padding: "2px 7px" }}
                  >{isBrowserOpen() ? "Focus" : "Open Browser"}</button>
                </div>
                {popupBlocked && (
                  <div style={{ fontSize: "9px", fontFamily: "var(--m)", color: "#cc7777", background: "rgba(204,119,119,0.08)", border: "1px solid rgba(204,119,119,0.2)", borderRadius: "4px", padding: "3px 6px", marginTop: "4px" }}>
                    ⚠ Popup blocked by browser. Click <strong>Open Browser</strong> above to allow it.
                  </div>
                )}
                {agentBrowserUrl && !popupBlocked && (
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
            <img
              src={busy ? "./Expressions/HappySpeak.png" : (expression === "serious" ? "./Expressions/Serious.png" : "./Expressions/Happy.png")}
              alt="Meow"
              style={{ width: "32px", height: "32px", borderRadius: "7px", objectFit: "cover", imageRendering: "pixelated" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "-0.4px" }}>Meow</span>
            <span style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>OpenRouter · StepFun 3.5 Flash (free)</span>
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
                <img src="./Expressions/Happy.png" alt="Meow" style={{ width: "80px", height: "80px", imageRendering: "pixelated" }} onError={(e) => { e.target.style.display = "none"; }} />
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
                if (m.role === "user" && typeof m.content === "string" && m.content.startsWith("[SYSTEM: Research results")) {
                  return (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(136,187,204,0.05)", border: "1px solid rgba(136,187,204,0.1)", borderRadius: "8px", fontSize: "11px", color: "var(--ac2)", fontFamily: "var(--m)" }}>
                      Research data received — AI processing results...
                    </div>
                  );
                }
                if (m.role === "user" && typeof m.content === "string" && m.content.startsWith("[SYSTEM: Browser agent results]")) {
                  return (
                    <div key={i} style={{ padding: "6px 10px", background: "rgba(124,224,138,0.05)", border: "1px solid rgba(124,224,138,0.12)", borderRadius: "8px", fontSize: "11px", color: "var(--ac)", fontFamily: "var(--m)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "9px" }}>●</span> Browser action results received — AI continuing task...
                    </div>
                  );
                }
                return (
                  <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "min(720px,94%)", display: "flex", gap: "8px", alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                    {m.role === "assistant" && (
                      <img
                        src={
                          /* last assistant message + currently busy = speaking */
                          (busy && i === msgs.length - 1) ? "./Expressions/HappySpeak.png"
                          : (expression === "serious" ? "./Expressions/Serious.png" : "./Expressions/Happy.png")
                        }
                        alt=""
                        style={{ width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0, marginTop: "2px", imageRendering: "pixelated" }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    )}
                    <div style={{ background: m.role === "user" ? "rgba(124,224,138,0.08)" : "rgba(255,255,255,0.02)", border: "1px solid var(--bd)", borderRadius: "10px", padding: "10px 12px", minWidth: 0 }}>
                      {m.role === "assistant" ? <Md text={m.content} /> : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{m.content}</div>}
                    </div>
                  </div>
                );
              })}
              {busy && (
                <div style={{ opacity: .6, fontSize: "12px", padding: "6px 2px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <img src="./Expressions/HappySpeak.png" alt="" style={{ width: "24px", height: "24px", imageRendering: "pixelated", animation: "bounce 1s infinite" }} onError={(e) => { e.target.style.display = "none"; }} />
                  <span style={{ animation: "bounce 1s infinite" }}>Thinking…</span>
                  {researchStatus && <span style={{ color: "var(--ac2)", fontFamily: "var(--m)", fontSize: "10px" }}>{researchStatus}</span>}
                </div>
              )}
              {err && <div style={{ color: "#f88", fontSize: "12px", padding: "6px 2px" }}>{err}</div>}
              <div ref={scrollRef} />
            </div>
          </div>

          {/* ═══ MEOW EXPRESSION DISPLAY ═══ */}
          <div style={{ padding: "6px 14px 2px", borderTop: "1px solid var(--bd)", background: "rgba(13,13,20,0.5)", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <img
                src={busy ? "./Expressions/HappySpeak.png" : (expression === "serious" ? "./Expressions/Serious.png" : "./Expressions/Happy.png")}
                alt="Meow"
                style={{
                  width: "80px", height: "80px", imageRendering: "pixelated",
                  transition: "all 0.4s ease",
                  animation: busy ? "pulse 1.5s ease-in-out infinite" : "none",
                }}
                onError={(e) => { e.target.style.display = "none"; }}
              />
              {/* Status dot */}
              <div style={{
                position: "absolute", bottom: "2px", right: "2px",
                width: "14px", height: "14px", borderRadius: "50%",
                background: busy ? "var(--ac2)" : expression === "serious" ? "var(--dg)" : "var(--ac)",
                border: "2px solid var(--bg)",
                animation: busy ? "pulse 1.5s ease-in-out infinite" : "none",
              }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {busy && (
                <span style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>
                  {researchStatus || "Processing your message..."}
                </span>
              )}
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
                {msgs.filter(m => !(m.role === "user" && typeof m.content === "string" && m.content.startsWith("[SYSTEM:"))).length} msgs
                {isBrowserOpen() && <span style={{ color: agentUserTookOver ? "var(--dg)" : "var(--ac)", marginLeft: "8px" }}>
                  {agentUserTookOver ? "browser: user control" : "browser: AI agent active"}
                </span>}
              </span>
              {busy && <button onClick={() => abortRef.current?.abort()} style={{ ...btn("#cc7777"), marginRight: "4px" }}>Cancel</button>}
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
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(1.03)} }
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

// ─── Error Boundary to prevent blank screen crashes ───
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Meow crashed:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return React.createElement("div", {
        style: { padding: "40px", background: "#07070b", color: "#cc7777", fontFamily: "monospace", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }
      },
        React.createElement("div", { style: { fontSize: "40px" } }, "\uD83D\uDE3F"),
        React.createElement("h2", { style: { color: "#e88", margin: 0 } }, "Meow encountered an error"),
        React.createElement("pre", { style: { color: "#888", fontSize: "12px", maxWidth: "600px", overflow: "auto", padding: "12px", background: "#0a0a12", borderRadius: "8px", border: "1px solid #181824" } },
          String(this.state.error)
        ),
        React.createElement("button", {
          onClick: () => {
            try { window.storage && window.storage.set("meow-chat", "[]"); } catch(e) {}
            try { window.localStorage.setItem("meow-chat", "[]"); } catch(e) {}
            this.setState({ hasError: false, error: null });
          },
          style: { padding: "8px 20px", background: "rgba(124,224,138,0.1)", border: "1px solid rgba(124,224,138,0.3)", borderRadius: "6px", color: "#7ce08a", cursor: "pointer", fontSize: "13px" }
        }, "Clear Chat & Recover"),
        React.createElement("button", {
          onClick: () => window.location.reload(),
          style: { padding: "8px 20px", background: "rgba(136,187,204,0.1)", border: "1px solid rgba(136,187,204,0.3)", borderRadius: "6px", color: "#88bbcc", cursor: "pointer", fontSize: "13px" }
        }, "Reload Page")
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  React.createElement(ErrorBoundary, null, React.createElement(Meow))
);
