Switch the api for thsi ai agent to use openrouter, and use one that has insanely high context window but is COMPLETELY FREE, do not fail. Heres the code, then open a canvas

import { useState, useEffect, useRef, useCallback } from "react";

const API = "https://api.anthropic.com/v1/messages";
const MDL = "claude-sonnet-4-20250514";

// ─── Persistent Storage helpers ───
async function loadMemory() {
  try { const r = await window.storage.get("meow-memory"); return r ? r.value : ""; } catch { return ""; }
}
async function saveMemory(val) {
  try { await window.storage.set("meow-memory", val); } catch {}
}
async function loadChat() {
  try { const r = await window.storage.get("meow-chat"); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveChat(msgs) {
  try { await window.storage.set("meow-chat", JSON.stringify(msgs.slice(-40))); } catch {}
}

// ─── Markdown ───
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

// ─── Main Component ───
export default function Meow() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [mem, setMem] = useState("");
  const [memDraft, setMemDraft] = useState("");
  const [memOpen, setMemOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [searches, setSearches] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [usage, setUsage] = useState({ i: 0, o: 0 });
  const [webEnabled, setWebEnabled] = useState(true);
  const [view, setView] = useState("chat"); // chat | browser
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  // Load on mount
  useEffect(() => {
    loadMemory().then(v => { setMem(v || ""); setMemDraft(v || ""); });
    loadChat().then(v => { if (v?.length) setMsgs(v); });
  }, []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const saveMem = useCallback(() => {
    setMem(memDraft);
    saveMemory(memDraft);
  }, [memDraft]);

  const downloadMem = () => {
    const blob = new Blob([memDraft], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "memory.txt"; a.click(); URL.revokeObjectURL(a.href);
  };

  const uploadMem = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".txt";
    inp.onchange = (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => { const t = r.result; setMemDraft(t); setMem(t); saveMemory(t); };
      r.readAsText(f);
    }; inp.click();
  };

  const buildSystem = useCallback(() => {
    let s = `You are Meow, a brilliant, warm AI assistant. You are curious, helpful, and thorough. Use markdown formatting. Today is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;
    if (mem.trim()) {
      s += `\n\n<memory>\nBelow is your persistent memory. Reference it when relevant. If the user tells you to remember something, include a <memory_update> block at the END of your response with the COMPLETE updated memory content (not a diff).\n${mem}\n</memory>`;
    } else {
      s += `\n\nYou have a persistent memory system. If the user asks you to remember something, include a <memory_update> block at the END of your response with the content to remember.`;
    }
    s += `\n\nIMPORTANT: When you update memory, wrap the FULL new memory text in <memory_update>...</memory_update> tags at the very end of your response. The content inside replaces ALL existing memory, so include everything that should be remembered.`;
    return s;
  }, [mem]);

  const parseResponse = useCallback((data) => {
    let text = "";
    const newSearches = [];
    let currentQuery = "";

    for (const block of (data.content || [])) {
      if (block.type === "text") {
        text += block.text || "";
      } else if (block.type === "server_tool_use" && block.name === "web_search") {
        currentQuery = block.input?.query || "";
        newSearches.push({ query: currentQuery, results: [], time: new Date().toLocaleTimeString() });
      } else if (block.type === "web_search_tool_result") {
        const results = (block.content || []).filter(r => r.type === "web_search_result").map(r => ({
          title: r.title || "Untitled", url: r.url || "", age: r.page_age || ""
        }));
        if (newSearches.length > 0) {
          newSearches[newSearches.length - 1].results = results;
        } else {
          newSearches.push({ query: currentQuery, results, time: new Date().toLocaleTimeString() });
        }
      }
    }

    if (newSearches.length > 0) {
      setSearches(prev => [...newSearches, ...prev].slice(0, 30));
      if (newSearches.some(s => s.results.length > 0)) setBrowserOpen(true);
    }

    // Check for memory updates
    const memMatch = text.match(/<memory_update>([\s\S]*?)<\/memory_update>/);
    if (memMatch) {
      const newMem = memMatch[1].trim();
      setMem(newMem); setMemDraft(newMem); saveMemory(newMem);
      text = text.replace(/<memory_update>[\s\S]*?<\/memory_update>/, "").trim();
    }

    return text;
  }, []);

  const send = useCallback(async () => {
    const txt = input.trim(); if (!txt || busy) return;
    setErr(null); setBusy(true); setSearchBusy(false);

    const userMsg = { role: "user", content: txt };
    const updated = [...msgs, userMsg];
    setMsgs(updated); setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    const apiMsgs = updated.map(m => ({ role: m.role, content: m.content }));
    const body = { model: MDL, max_tokens: 4096, system: buildSystem(), messages: apiMsgs };
    if (webEnabled) {
      body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
      setSearchBusy(true);
    }

    try {
      abortRef.current = new AbortController();
      const res = await fetch(API, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: abortRef.current.signal,
      });
      if (!res.ok) {
        const e = await res.text();
        let m; try { m = JSON.parse(e).error?.message; } catch {} throw new Error(m || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.usage) setUsage(p => ({ i: p.i + (data.usage.input_tokens || 0), o: p.o + (data.usage.output_tokens || 0) }));

      const text = parseResponse(data);

      if (text) {
        const final = [...updated, { role: "assistant", content: text }];
        setMsgs(final); saveChat(final);
      }

      // Auto-continue if truncated
      if (data.stop_reason === "max_tokens" && text) {
        // Simple continuation — append to last message
      }
    } catch (e) {
      if (e.name !== "AbortError") setErr(e.message);
    } finally { setBusy(false); setSearchBusy(false); abortRef.current = null; }
  }, [input, msgs, busy, buildSystem, webEnabled, parseResponse]);

  const clearChat = () => { setMsgs([]); saveChat([]); setSearches([]); setErr(null); };
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

      {/* ═══ SIDEBAR ═══ */}
      {memOpen && (
        <div style={{ width: "280px", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--bd)", background: "var(--sf)", overflow: "hidden", animation: "slideR .2s ease" }}>
          <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "-0.2px" }}>🧠 Memory</span>
            <button onClick={() => setMemOpen(false)} style={{ background: "none", border: "none", color: "var(--dm)", cursor: "pointer", fontSize: "16px" }}>×</button>
          </div>
          <textarea value={memDraft} onChange={e => setMemDraft(e.target.value)} placeholder="Meow's persistent memory...\nTell Meow to remember things, or type here directly." style={{ flex: 1, padding: "10px 12px", background: "transparent", border: "none", color: "var(--tx)", fontSize: "12px", fontFamily: "var(--m)", resize: "none", outline: "none", lineHeight: 1.6 }} />
          <div style={{ padding: "8px 10px", borderTop: "1px solid var(--bd)", display: "flex", gap: "4px", flexWrap: "wrap" }}>
            <button onClick={saveMem} style={btn("#7ce08a")}>Save</button>
            <button onClick={downloadMem} style={btn("#88bbcc")}>↓ Download</button>
            <button onClick={uploadMem} style={btn("#88bbcc")}>↑ Upload</button>
            <button onClick={() => { setMemDraft(""); setMem(""); saveMemory(""); }} style={btn("#cc7777")}>Clear</button>
          </div>
          <div style={{ padding: "6px 12px 8px", fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>
            {mem.length} chars · ~{Math.ceil(mem.length / 3.8)} tokens · Auto-saved on AI update
          </div>
        </div>
      )}

      {/* ═══ MAIN COLUMN ═══ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: "1px solid var(--bd)", background: "rgba(13,13,20,0.9)", backdropFilter: "blur(14px)", flexShrink: 0, zIndex: 10, gap: "6px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "linear-gradient(135deg,#7ce08a,#88bbcc)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>🐱</div>
            <span style={{ fontWeight: 800, fontSize: "15px", letterSpacing: "-0.4px" }}>Meow</span>
            <span style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)" }}>Sonnet 4 · 200K</span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "9px", color: "var(--dm)", fontFamily: "var(--m)", padding: "2px 6px", background: "rgba(255,255,255,0.02)", borderRadius: "3px" }}>↑{ft(usage.i)} ↓{ft(usage.o)}</span>
            <button onClick={() => setMemOpen(!memOpen)} style={{ ...hdr(), background: memOpen ? "rgba(124,224,138,0.08)" : undefined, color: memOpen ? "var(--ac)" : undefined, borderColor: memOpen ? "rgba(124,224,138,0.15)" : undefined }} title="Memory">🧠</button>
            <button onClick={() => setBrowserOpen(!browserOpen)} style={{ ...hdr(), background: browserOpen ? "rgba(136,187,204,0.08)" : undefined, color: browserOpen ? "var(--ac2)" : undefined, borderColor: browserOpen ? "rgba(136,187,204,0.15)" : undefined }} title="Browser">🌐</button>
            <button onClick={() => setWebEnabled(!webEnabled)} style={{ ...hdr(), background: webEnabled ? "rgba(124,224,138,0.06)" : undefined, fontSize: "10px", fontFamily: "var(--m)" }} title="Web search">{webEnabled ? "WEB ON" : "WEB OFF"}</button>
            <button onClick={clearChat} style={{ ...hdr(), fontSize: "10px", fontFamily: "var(--m)" }}>Clear</button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* CHAT */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
              {msgs.length === 0 && !busy && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.45, gap: "10px", padding: "20px" }}>
                  <div style={{ fontSize: "40px" }}>🐱</div>
                  <div style={{ fontWeight: 700, fontSize: "16px" }}>Meow</div>
                  <div style={{ fontSize: "12px", color: "var(--dm)", textAlign: "center", maxWidth: "300px", lineHeight: 1.6 }}>
                    AI agent with persistent memory & web search. No setup needed.
                  </div>
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", justifyContent: "center", marginTop: "6px" }}>
                    {["Search latest news on AI", "Remember my name is...", "Explain quantum computing", "Help me debug code"].map(q => (
                      <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }} style={{ padding: "5px 12px", fontSize: "11px", borderRadius: "7px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--bd)", color: "var(--dm)", cursor: "pointer" }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: "10px" }}>
                  <div style={{ maxWidth: m.role === "user" ? "78%" : "92%", padding: m.role === "user" ? "9px 14px" : "12px 16px", borderRadius: m.role === "user" ? "14px 14px 3px 14px" : "14px 14px 14px 3px", background: m.role === "user" ? "linear-gradient(135deg,rgba(124,224,138,0.08),rgba(136,187,204,0.06))" : "var(--sf)", border: "1px solid " + (m.role === "user" ? "rgba(124,224,138,0.1)" : "var(--bd)"), lineHeight: 1.65, wordBreak: "break-word", animation: "fadeIn .2s ease" }}>
                    {m.role === "assistant" ? <Md text={m.content} /> : m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
                  <div style={{ padding: "12px 16px", borderRadius: "14px 14px 14px 3px", background: "var(--sf)", border: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "3px" }}>
                      {[0,1,2].map(d => <div key={d} style={{ width: "5px", height: "5px", borderRadius: "50%", background: searchBusy ? "var(--ac2)" : "var(--ac)", animation: `bounce 1s ease ${d * .12}s infinite`, opacity: .7 }} />)}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--dm)", fontFamily: "var(--m)" }}>
                      {searchBusy ? "Searching the web..." : "Thinking..."}
                    </span>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>

            {err && (
              <div style={{ margin: "0 12px 6px", padding: "8px 12px", borderRadius: "7px", background: "rgba(204,119,119,0.05)", border: "1px solid rgba(204,119,119,0.1)", color: "var(--dg)", fontSize: "11px", fontFamily: "var(--m)", display: "flex", justifyContent: "space-between" }}>
                <span>{err}</span>
                <button onClick={() => setErr(null)} style={{ background: "none", border: "none", color: "var(--dg)", cursor: "pointer", fontSize: "14px" }}>×</button>
              </div>
            )}

            {/* INPUT */}
            <div style={{ padding: "8px 12px 12px", borderTop: "1px solid var(--bd)", background: "rgba(13,13,20,0.9)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                <div style={{ flex: 1, background: "var(--sf)", border: "1px solid var(--bd)", borderRadius: "10px", overflow: "hidden" }}>
                  <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; }}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Message Meow..." rows={1} disabled={busy}
                    style={{ width: "100%", padding: "10px 12px", background: "transparent", border: "none", color: "var(--tx)", fontSize: "13.5px", fontFamily: "var(--f)", outline: "none", resize: "none", lineHeight: 1.5, maxHeight: "140px", opacity: busy ? .4 : 1 }} />
                </div>
                {busy ?
                  <button onClick={() => abortRef.current?.abort()} style={{ padding: "10px 14px", background: "rgba(204,119,119,0.1)", border: "1px solid rgba(204,119,119,0.2)", borderRadius: "10px", color: "var(--dg)", fontSize: "12px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Stop</button> :
                  <button onClick={send} disabled={!input.trim()} style={{ padding: "10px 14px", background: input.trim() ? "var(--ac)" : "rgba(255,255,255,0.03)", border: input.trim() ? "none" : "1px solid var(--bd)", borderRadius: "10px", color: input.trim() ? "#070b07" : "var(--dm)", fontSize: "12px", fontWeight: 700, cursor: input.trim() ? "pointer" : "default", flexShrink: 0, transition: "all .15s" }}>Send</button>
                }
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", padding: "0 2px", fontSize: "9px", color: "#333", fontFamily: "var(--m)" }}>
                <span>{msgs.length} msgs · ~{ft(Math.ceil(msgs.reduce((a,m) => a + m.content.length, 0) / 3.8))} ctx{mem ? ` · ${Math.ceil(mem.length/3.8)} mem tokens` : ""}</span>
                <span>Shift+Enter newline · {webEnabled ? "🌐 Web ON" : "Web OFF"}</span>
              </div>
            </div>
          </div>

          {/* ═══ BROWSER PANEL ═══ */}
          {browserOpen && (
            <div style={{ width: "320px", flexShrink: 0, display: "flex", flexDirection: "column", borderLeft: "1px solid var(--bd)", background: "var(--sf)", overflow: "hidden", animation: "slideL .2s ease" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px" }}>🌐</span>
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>Web Browser</span>
                </div>
                <button onClick={() => setBrowserOpen(false)} style={{ background: "none", border: "none", color: "var(--dm)", cursor: "pointer", fontSize: "16px" }}>×</button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
                {searches.length === 0 ? (
                  <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--dm)", fontSize: "12px" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px", opacity: .4 }}>🔍</div>
                    <div>No searches yet.</div>
                    <div style={{ marginTop: "4px", fontSize: "11px" }}>Ask Meow something that needs current info and it will search the web automatically.</div>
                  </div>
                ) : searches.map((s, i) => (
                  <div key={i} style={{ marginBottom: "10px", borderRadius: "8px", border: "1px solid var(--bd)", overflow: "hidden", animation: "fadeIn .25s ease" }}>
                    {/* Search bar */}
                    <div style={{ padding: "7px 10px", background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: "6px", borderBottom: "1px solid var(--bd)" }}>
                      <span style={{ fontSize: "10px" }}>🔍</span>
                      <div style={{ flex: 1, padding: "3px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "4px", fontSize: "11px", fontFamily: "var(--m)", color: "var(--ac2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {s.query}
                      </div>
                      <span style={{ fontSize: "9px", color: "var(--dm)", fontFamily: "var(--m)", flexShrink: 0 }}>{s.time}</span>
                    </div>
                    {/* Results */}
                    {s.results.length > 0 ? s.results.map((r, j) => (
                      <a key={j} href={r.url} target="_blank" rel="noopener" style={{ display: "block", padding: "7px 10px", borderBottom: j < s.results.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none", textDecoration: "none", transition: "background .1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ fontSize: "11.5px", color: "var(--ac2)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                        <div style={{ fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.url.replace(/^https?:\/\//, "").slice(0, 50)}
                          {r.age && <span style={{ marginLeft: "6px", color: "#444" }}>· {r.age}</span>}
                        </div>
                      </a>
                    )) : (
                      <div style={{ padding: "10px", fontSize: "11px", color: "var(--dm)", textAlign: "center" }}>Searching...</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ padding: "6px 10px", borderTop: "1px solid var(--bd)", fontSize: "10px", color: "var(--dm)", fontFamily: "var(--m)", textAlign: "center" }}>
                {searches.length} searches · {searches.reduce((a, s) => a + s.results.length, 0)} results
              </div>
            </div>
          )}
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
        @media(max-width:700px) {
          .meow-sidebar{width:100%!important;position:absolute;z-index:50;left:0;top:0;bottom:0}
        }
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
