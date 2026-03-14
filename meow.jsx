const { useState, useEffect, useRef, useCallback } = React;

const API = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "stepfun/step-3.5-flash:free";
const MODEL_FALLBACKS = [
  DEFAULT_MODEL,
  "stepfun/step-3.5-flash:free",
  "qwen/qwen3-coder:free",
];
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

// ─── Browser Popup Manager ───
let _browserPopup = null;
function openBrowserPopup(url) {
  if (!url) return;
  if (_browserPopup && !_browserPopup.closed) {
    _browserPopup.location.href = url;
    _browserPopup.focus();
  } else {
    _browserPopup = window.open(url, "meow_browser", "width=1000,height=720,menubar=no,toolbar=yes,location=yes,status=yes,scrollbars=yes,resizable=yes");
  }
  return _browserPopup;
}
function isBrowserOpen() {
  return _browserPopup && !_browserPopup.closed;
}

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
  const [researchStatus, setResearchStatus] = useState("");
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

1. **To search the web**: Include <web_search>your search query</web_search> in your response. The system will automatically execute the search and feed results back to you. You can then provide an informed answer.

2. **To read a webpage**: Include <read_url>https://example.com</read_url> in your response. The system will fetch the page content for you.

3. **To open a page in the user's browser popup**: Include <open_browser>https://example.com</open_browser> in your response.

You should PROACTIVELY research when:
- The user asks about current events, news, or recent information
- You need to verify facts or find up-to-date data
- The user asks you to look something up or research a topic
- You're unsure about something and want to check mainstream media sources
- The topic involves recent developments, prices, statistics, etc.

When researching, search multiple queries if needed to build comprehensive understanding. Cite your sources with URLs. Search mainstream media (CNN, BBC, Reuters, AP, NYT, etc.) for news topics.`;

    return s;
  }, [mem]);

  // ─── Parse AI response (memory updates, search triggers, browser commands) ───
  const parseResponse = useCallback((text) => {
    let cleaned = text;
    const actions = { memoryUpdate: null, searches: [], readUrls: [], openUrls: [] };

    // Extract memory updates
    const memMatch = cleaned.match(/<memory_update>([\s\S]*?)<\/memory_update>/);
    if (memMatch) {
      actions.memoryUpdate = memMatch[1].trim();
      cleaned = cleaned.replace(/<memory_update>[\s\S]*?<\/memory_update>/, "").trim();
    }

    // Extract web search requests
    const searchMatches = cleaned.matchAll(/<web_search>([\s\S]*?)<\/web_search>/g);
    for (const m of searchMatches) {
      actions.searches.push(m[1].trim());
    }
    cleaned = cleaned.replace(/<web_search>[\s\S]*?<\/web_search>/g, "").trim();

    // Extract read URL requests
    const readMatches = cleaned.matchAll(/<read_url>([\s\S]*?)<\/read_url>/g);
    for (const m of readMatches) {
      actions.readUrls.push(m[1].trim());
    }
    cleaned = cleaned.replace(/<read_url>[\s\S]*?<\/read_url>/g, "").trim();

    // Extract open browser requests
    const openMatches = cleaned.matchAll(/<open_browser>([\s\S]*?)<\/open_browser>/g);
    for (const m of openMatches) {
      actions.openUrls.push(m[1].trim());
    }
    cleaned = cleaned.replace(/<open_browser>[\s\S]*?<\/open_browser>/g, "").trim();

    return { text: cleaned, actions };
  }, []);

  // ─── Call AI API ───
  const callAI = useCallback(async (apiMsgs, key) => {
    const buildBody = (model) => ({ model, messages: apiMsgs });
    let data = null;
    let usedModel = DEFAULT_MODEL;
    let lastErr = null;

    for (const model of MODEL_FALLBACKS) {
      const res = await fetch(API, {
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

      if (res.ok) {
        data = await res.json();
        usedModel = model;
        break;
      }

      const rawBody = await res.text();
      const msg = parseErrorMessage(rawBody, res.status);

      if (res.status === 401 && /missing authentication|unauthorized|invalid api key|malformed api key/i.test(msg)) {
        throw new Error(`${msg}. Set a valid OpenRouter key (starts with "sk-or-v1-").`);
      }

      lastErr = new Error(msg);
      const invalidModel = /valid model id|model.*not found|no such model/i.test(msg);
      if (!invalidModel || model === MODEL_FALLBACKS[MODEL_FALLBACKS.length - 1]) {
        throw lastErr;
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
      if (!key) {
        key = promptForApiKey("Missing OpenRouter API key. Enter your key:");
        if (!key) throw new Error("Missing OPENROUTER_API_KEY.");
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

        const { data, usedModel } = await callAI(apiMsgs, key);
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
  }, [input, msgs, busy, buildSystem, parseResponse, callAI, apiKey, promptForApiKey, doSearch]);

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
              {/* URL Bar */}
              <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                  <input
                    value={browserUrl}
                    onChange={e => setBrowserUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleBrowserGo(); }}
                    placeholder="Enter URL to open..."
                    style={{ flex: 1, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--bd)", borderRadius: "5px", color: "var(--tx)", fontSize: "11px", fontFamily: "var(--m)", outline: "none" }}
                  />
                  <button onClick={handleBrowserGo} style={btn("#88bbcc")} title="Open in popup browser">Go</button>
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
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
              title={apiKey ? "API key set" : "API key missing"}
            >
              {apiKey ? "KEY ✓" : "KEY !"}
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
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            {msgs.length === 0 && !busy && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.45, gap: "10px", padding: "20px" }}>
                <div style={{ fontSize: "40px" }}>🐱</div>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>Meow</div>
                <div style={{ fontSize: "12px", color: "var(--dm)", textAlign: "center", maxWidth: "340px", lineHeight: 1.6 }}>
                  AI agent with persistent memory, web search, and internet browser.<br/>
                  Open the sidebar to search the web or browse pages.
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
                {msgs.filter(m => !m.content.startsWith("[SYSTEM:")).length} msgs
                {isBrowserOpen() && <span style={{ color: "var(--ac2)", marginLeft: "8px" }}>browser popup active</span>}
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
