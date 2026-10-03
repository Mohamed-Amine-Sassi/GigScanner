import { useState, useEffect, useMemo, useRef, useCallback } from "react";

const API = "http://localhost:8001/api";

const TABS = [
  { key: "raw", label: "All signals" },
  { key: "ranked", label: "Strong matches" },
  { key: "drafts", label: "Drafts" },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700&family=DM+Sans:wght@400;500;600&display=swap');
.gr{--bg:#f4f6f8;--surface:#fff;--ink:#101820;--muted:#5d6876;--line:#e2e6eb;--accent:#0b7a85;--accent-soft:#e0f2f4;
--strong:#12805c;--mid:#b7791f;--weak:#8a93a0;--danger:#c2410c;--shadow:0 1px 2px rgba(16,24,32,.05);
font-family:'DM Sans',system-ui,sans-serif;color:var(--ink);background:var(--bg);min-height:100vh;font-size:15px;line-height:1.5}
@media (prefers-color-scheme:dark){.gr{--bg:#0d1317;--surface:#141c22;--ink:#e8edf1;--muted:#97a3af;--line:#25313a;--accent:#47c3cf;--accent-soft:#12303a;
--strong:#4ade9d;--mid:#f0b94d;--weak:#7d8996;--danger:#fb923c;--shadow:none}}
.gr *{box-sizing:border-box}
.gr button,.gr input,.gr textarea{font:inherit;color:inherit}
.gr :focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.gr h1,.gr h2,.gr h3{font-family:'Bricolage Grotesque','DM Sans',sans-serif;margin:0;letter-spacing:-.01em}
.gr .top{position:sticky;top:0;z-index:5;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.gr .top-in{max-width:1180px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:24px;flex-wrap:wrap}
.gr .brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:20px;display:flex;align-items:center;gap:10px}
.gr .dot{width:10px;height:10px;border-radius:50%;background:var(--accent)}
.gr .tabs{display:flex;gap:4px;flex:1;flex-wrap:wrap}
.gr .tab{display:flex;align-items:center;gap:8px;padding:8px 14px;border:0;border-radius:999px;background:transparent;color:var(--muted);cursor:pointer;font-weight:500}
.gr .tab:hover{color:var(--ink)}
.gr .tab[aria-selected=true]{background:var(--ink);color:var(--bg)}
.gr .count{font-size:12px;padding:0 7px;border-radius:99px;background:color-mix(in srgb,currentColor 16%,transparent)}
.gr .sync{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px}
.gr .btn{padding:8px 14px;border-radius:8px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-weight:500;font-size:14px}
.gr .btn:hover:not(:disabled){border-color:var(--muted)}
.gr .btn:disabled{opacity:.5;cursor:not-allowed}
.gr .btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.gr .btn.danger{color:var(--danger)}
.gr .btn.danger.on{background:color-mix(in srgb,var(--danger) 14%,transparent);border-color:var(--danger)}
.gr main{max-width:1180px;margin:0 auto;padding:28px 24px 80px}
.gr .toolbar{display:flex;gap:12px;align-items:center;margin-bottom:18px;flex-wrap:wrap}
.gr .search{flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface)}
.gr .chips{display:flex;gap:6px}
.gr .chip{padding:7px 12px;border-radius:99px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font-size:13px;color:var(--muted)}
.gr .chip[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600}
.gr .split{display:grid;grid-template-columns:minmax(280px,380px) 1fr;gap:20px;align-items:start}
.gr .list{display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 190px);overflow:auto;padding:2px}
.gr .row{display:flex;gap:12px;align-items:center;text-align:left;width:100%;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);cursor:pointer;box-shadow:var(--shadow)}
.gr .row:hover{border-color:var(--muted)}
.gr .row[aria-current=true]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.gr .row-t{font-weight:600;font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gr .row-s{font-size:12px;color:var(--muted);margin-top:2px}
.gr .panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:26px;box-shadow:var(--shadow);position:sticky;top:84px}
.gr .panel h2{font-size:22px;line-height:1.25}
.gr .meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px;color:var(--muted);font-size:13px}
.gr .badge{padding:2px 8px;border:1px solid var(--line);border-radius:6px;font-size:12px;font-weight:600;color:var(--muted)}
.gr .pill{padding:2px 9px;border-radius:99px;font-size:12px;font-weight:600;background:color-mix(in srgb,var(--c) 15%,transparent);color:var(--c)}
.gr .desc{margin:18px 0;color:var(--muted);max-width:68ch;white-space:pre-wrap;line-height:1.65}
.gr .sec{font-size:13px;font-weight:600;margin:20px 0 8px}
.gr .reasons{display:flex;flex-wrap:wrap;gap:6px}
.gr .reason{font-size:13px;padding:4px 10px;border-radius:8px;background:var(--accent-soft);color:var(--ink)}
.gr .contact{display:flex;align-items:center;gap:8px;font-size:14px;margin-top:6px}
.gr .bars{display:grid;gap:10px;margin-top:6px}
.gr .bar-l{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:3px;text-transform:capitalize}
.gr .bar{height:5px;border-radius:3px;background:var(--line);overflow:hidden}
.gr .bar>i{display:block;height:100%;background:var(--accent);border-radius:3px}
.gr .actions{display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:22px;flex-wrap:wrap}
.gr .ring{position:relative;flex-shrink:0}
.gr .ring svg{transform:rotate(-90deg);display:block}
.gr .ring span{position:absolute;inset:0;display:grid;place-items:center;font-weight:600}
.gr .editor-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
.gr .tools{display:flex;gap:6px;margin:16px 0 8px}
.gr .tool{width:32px;height:32px;border:1px solid var(--line);border-radius:8px;background:transparent;cursor:pointer;color:var(--muted)}
.gr textarea{width:100%;min-height:300px;resize:vertical;padding:14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);line-height:1.65}
.gr .foot{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px}
.gr .empty{text-align:center;padding:72px 20px;color:var(--muted)}
.gr .empty h3{color:var(--ink);font-size:18px;margin-bottom:6px}
.gr .skel{height:68px;border-radius:12px;background:var(--line);margin-bottom:8px;animation:pulse 1.4s ease-in-out infinite}
.gr .banner{padding:12px 16px;border:1px solid var(--danger);border-radius:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--danger)}
.gr .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:10px 18px;border-radius:10px;font-size:14px;z-index:20}
@keyframes pulse{50%{opacity:.5}}
@media (max-width:900px){.gr .split{grid-template-columns:1fr}.gr .list{max-height:none}.gr .panel{position:static}.gr main{padding:20px 16px 80px}}
@media (prefers-reduced-motion:reduce){.gr *{animation:none!important;transition:none!important}}
`;

function timeAgo(iso) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

const tone = (s) => (s == null ? "var(--weak)" : s >= 70 ? "var(--strong)" : s >= 40 ? "var(--mid)" : "var(--weak)");

function Ring({ score, size = 44 }) {
  const sw = size > 60 ? 6 : 4;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  return (
    <div className="ring" style={{ width: size, height: size, color: tone(score), fontSize: size > 60 ? 22 : 13 }} aria-label={`Fit score ${score != null ? Math.round(score) : "unknown"}`}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <span>{score != null ? Math.round(score) : "–"}</span>
    </div>
  );
}

function Empty({ title, hint }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{hint}</p>
    </div>
  );
}

function Skeleton() {
  return <div>{[0, 1, 2, 3].map(i => <div key={i} className="skel" />)}</div>;
}

function Contact({ contact }) {
  const ok = contact?.method === "email";
  return (
    <div className="contact">
      <span className="dot" style={{ background: ok ? "var(--strong)" : "var(--weak)" }} />
      {ok ? contact.value : <span style={{ color: "var(--muted)" }}>No email. Use the apply link.</span>}
    </div>
  );
}

// ---------- postings (shared by All signals + Strong matches) ----------

function PostingDetail({ post }) {
  const hasRate = post.rate_min || post.rate_max;
  const breakdown = post.score_breakdown ? Object.entries(post.score_breakdown) : [];
  return (
    <article className="panel">
      <div className="editor-head">
        <div>
          <h2>{post.title}</h2>
          <div className="meta">
            {post.source && <span className="badge">{post.source}</span>}
            {timeAgo(post.posted_at) && <span>{timeAgo(post.posted_at)}</span>}
            {hasRate && <span>${post.rate_min ?? "?"}–{post.rate_max ?? "?"}/hr</span>}
            {post.hours_per_week && <span>{post.hours_per_week}+ hrs/week</span>}
          </div>
        </div>
        <Ring score={post.fit_score} size={72} />
      </div>

      <p className="desc">{post.description || "No description available."}</p>

      {post.reasons?.length > 0 && (
        <>
          <div className="sec">Why it matched</div>
          <div className="reasons">{post.reasons.map((r, i) => <span key={i} className="reason">{r}</span>)}</div>
        </>
      )}
      {breakdown.length > 0 && (
        <>
          <div className="sec">Score breakdown</div>
          <div className="bars">
            {breakdown.map(([k, v]) => (
              <div key={k}>
                <div className="bar-l"><span>{k.replace(/_/g, " ")}</span><span>{Math.round(v)}</span></div>
                <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sec">Contact</div>
      <Contact contact={post.contact} />

      <div className="actions">
        <span />
        <a className="btn primary" href={post.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>Open posting</a>
      </div>
    </article>
  );
}

function PostingBrowser({ items, noun }) {
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [focusedUrl, setFocusedUrl] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? [])
      .filter(p => (p.fit_score ?? 0) >= minScore)
      .filter(p => !q || `${p.title} ${p.source} ${p.description ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
  }, [items, query, minScore]);

  const focused = filtered.find(p => p.url === focusedUrl) ?? filtered[0] ?? null;

  return (
    <>
      <div className="toolbar">
        <input className="search" type="search" placeholder={`Search ${noun}`} value={query}
          onChange={e => setQuery(e.target.value)} aria-label={`Search ${noun}`} />
        <div className="chips" role="group" aria-label="Minimum score">
          {[[0, "All"], [40, "40+"], [70, "70+"], [85, "85+"]].map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={minScore === v} onClick={() => setMinScore(v)}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title={items?.length ? "Nothing matches these filters" : `No ${noun} yet`}
          hint={items?.length ? "Lower the minimum score or clear the search." : "Run a scan from the backend to pull in new gigs."} />
      ) : (
        <div className="split">
          <div className="list">
            {filtered.map((p, i) => (
              <button key={p.url ?? i} className="row" aria-current={focused?.url === p.url} onClick={() => setFocusedUrl(p.url)}>
                <Ring score={p.fit_score} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div className="row-t">{p.title}</div>
                  <div className="row-s">{p.source}{timeAgo(p.posted_at) ? ` • ${timeAgo(p.posted_at)}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
          {focused && <PostingDetail post={focused} />}
        </div>
      )}
    </>
  );
}

// ---------- drafts ----------

function Toolbar({ textareaRef, onChange }) {
  const wrap = (before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    onChange(value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, e + before.length); });
  };
  const bullets = () => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const ls = value.lastIndexOf("\n", s - 1) + 1;
    const out = value.slice(ls, e).split("\n").map(l => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
    onChange(value.slice(0, ls) + out + value.slice(e));
    el.focus();
  };
  return (
    <div className="tools">
      <button type="button" className="tool" style={{ fontWeight: 700 }} onClick={() => wrap("**")} aria-label="Bold">B</button>
      <button type="button" className="tool" style={{ fontStyle: "italic" }} onClick={() => wrap("_")} aria-label="Italic">I</button>
      <button type="button" className="tool" style={{ textDecoration: "underline" }} onClick={() => wrap("<u>", "</u>")} aria-label="Underline">U</button>
      <button type="button" className="tool" onClick={bullets} aria-label="Bulleted list">•</button>
    </div>
  );
}

const decisionColor = (d) => (d === "approve" ? "var(--strong)" : d === "discard" ? "var(--danger)" : "var(--mid)");
const decisionLabel = (d) => (d === "approve" ? "Sent" : d === "discard" ? "Discarded" : "Needs review");

function DraftEditor({ draft, onFieldChange, onSave, toast }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(null);
  const text = draft.edited_pitch ?? "";
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const sent = draft.decision === "approve";

  const regenerate = async () => {
    setBusy("regen");
    try {
      const res = await fetch(`${API}/drafts/${encodeURIComponent(draft.url)}/regenerate`, { method: "POST" });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      if (updated?.edited_pitch != null) onFieldChange("edited_pitch", updated.edited_pitch);
      toast("New draft ready");
    } catch {
      toast("Couldn't regenerate. Try again.");
    } finally { setBusy(null); }
  };

  const send = async () => {
    if (!window.confirm(`Send this pitch to ${draft.email ?? "the contact"}?`)) return;
    setBusy("send");
    try {
      const res = await fetch(`${API}/drafts/${encodeURIComponent(draft.url)}/send`, { method: "POST" });
      if (res.ok) { onFieldChange("decision", "approve"); toast("Pitch sent"); }
      else { const err = await res.json().catch(() => ({})); toast(`Send failed: ${err.detail ?? res.status}`); }
    } catch { toast("Send failed: can't reach the server"); }
    finally { setBusy(null); }
  };

  const save = async () => {
    setBusy("save");
    try { await onSave(); toast("Draft saved"); }
    catch { toast("Couldn't save. Check the server."); }
    finally { setBusy(null); }
  };

  return (
    <article className="panel">
      <div className="editor-head">
        <div>
          <h2>{draft.title}</h2>
          <div className="meta">
            {draft.source && <span className="badge">{draft.source}</span>}
            <span className="pill" style={{ "--c": decisionColor(draft.decision) }}>{decisionLabel(draft.decision)}</span>
            {draft.email && <span>To: {draft.email}</span>}
          </div>
        </div>
        <button className="btn" onClick={regenerate} disabled={busy || sent}>{busy === "regen" ? "Regenerating…" : "Regenerate"}</button>
      </div>

      <Toolbar textareaRef={ref} onChange={v => onFieldChange("edited_pitch", v)} />
      <textarea ref={ref} value={text} disabled={sent} onChange={e => onFieldChange("edited_pitch", e.target.value)} aria-label="Pitch text" />
      <div className="foot"><span>{words} words</span><span>{sent ? "This pitch has been sent." : "Edits stay local until you save."}</span></div>

      <div className="actions">
        <button className={`btn danger ${draft.decision === "discard" ? "on" : ""}`} disabled={busy || sent}
          onClick={() => onFieldChange("decision", draft.decision === "discard" ? null : "discard")}>
          {draft.decision === "discard" ? "Undo discard" : "Discard"}
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy === "save" ? "Saving…" : "Save draft"}</button>
          <button className="btn primary" onClick={send} disabled={busy || sent || !draft.email}
            title={!draft.email ? "This posting has no email contact" : undefined}>
            {busy === "send" ? "Sending…" : "Send pitch"}
          </button>
        </div>
      </div>
    </article>
  );
}

function DraftsView({ drafts, updateDraft, saveDraft, toast }) {
  const [focusedUrl, setFocusedUrl] = useState(null);
  if (drafts.length === 0) return <Empty title="No drafts to review" hint="Pitches appear here after the pipeline drafts them." />;
  const focused = drafts.find(d => d.url === focusedUrl) ?? drafts[0];

  return (
    <div className="split">
      <div className="list">
        {drafts.map((d, i) => (
          <button key={d.url ?? i} className="row" aria-current={focused.url === d.url} onClick={() => setFocusedUrl(d.url)}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="row-t">{d.title}</div>
              <div className="row-s" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                <span className="pill" style={{ "--c": decisionColor(d.decision) }}>{decisionLabel(d.decision)}</span>
                <span>{d.source}</span>
              </div>
            </div>
            {d.fit_score != null && <Ring score={d.fit_score} size={36} />}
          </button>
        ))}
      </div>
      <DraftEditor key={focused.url} draft={focused} toast={toast}
        onFieldChange={(f, v) => updateDraft(focused.url, f, v)} onSave={() => saveDraft(focused)} />
    </div>
  );
}

// ---------- app ----------

export default function App() {
  const [tab, setTab] = useState("raw");
  const [raw, setRaw] = useState(null);
  const [ranked, setRanked] = useState(null);
  const [drafts, setDrafts] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState(null);

  const toast = useCallback((m) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const load = useCallback(async () => {
    setSyncing(true);
    setError(false);
    try {
      const [a, b, c] = await Promise.all(
        ["raw-postings", "ranked-postings", "drafts"].map(p => fetch(`${API}/${p}`).then(r => { if (!r.ok) throw new Error(); return r.json(); }))
      );
      setRaw(a); setRanked(b); setDrafts(c); setLastSynced(new Date());
    } catch {
      setError(true);
    } finally { setSyncing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateDraft = (url, field, value) =>
    setDrafts(prev => prev.map(d => (d.url === url ? { ...d, [field]: value } : d)));

  const saveDraft = async (draft) => {
    const res = await fetch(`${API}/drafts/${encodeURIComponent(draft.url)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: draft.decision, edited_pitch: draft.edited_pitch }),
    });
    if (!res.ok) throw new Error();
  };

  const counts = {
    raw: raw?.length ?? 0,
    ranked: ranked?.length ?? 0,
    drafts: (drafts ?? []).filter(d => (d.decision ?? "pending") === "pending").length,
  };
  const loading = (tab === "raw" && !raw) || (tab === "ranked" && !ranked) || (tab === "drafts" && !drafts);

  return (
    <div className="gr">
      <style>{css}</style>
      <header className="top">
        <div className="top-in">
          <div className="brand"><span className="dot" />Gig Radar</div>
          <nav className="tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.key} role="tab" className="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                {t.label}<span className="count">{counts[t.key]}</span>
              </button>
            ))}
          </nav>
          <div className="sync">
            <span>{syncing ? "Syncing…" : lastSynced ? `Updated ${lastSynced.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span>
            <button className="btn" onClick={load} disabled={syncing}>Refresh</button>
          </div>
        </div>
      </header>

      <main>
        {error && (
          <div className="banner" role="alert">
            <span>Can't reach the backend at {API}. Check that FastAPI is running.</span>
            <button className="btn" onClick={load}>Retry</button>
          </div>
        )}
        {loading ? (error ? null : <Skeleton />) : (
          <>
            {tab === "raw" && <PostingBrowser key="raw" items={raw} noun="signals" />}
            {tab === "ranked" && <PostingBrowser key="ranked" items={ranked} noun="matches" />}
            {tab === "drafts" && <DraftsView drafts={drafts} updateDraft={updateDraft} saveDraft={saveDraft} toast={toast} />}
          </>
        )}
      </main>

      {message && <div className="toast" role="status">{message}</div>}
    </div>
  );
}