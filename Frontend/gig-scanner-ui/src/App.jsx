import { useState, useEffect, useMemo, useRef } from "react";

const API = "http://localhost:8000/api";

const NAV = [
  { key: "raw", label: "All Signals" },
  { key: "ranked", label: "Strong Matches" },
  { key: "drafts", label: "Drafts" },
];

// ---------- small shared pieces ----------

function timeAgo(iso) {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function NavIcon({ type }) {
  const stroke = "currentColor";
  if (type === "raw") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke={stroke} strokeWidth="1.3" />
        <circle cx="8" cy="8" r="3" stroke={stroke} strokeWidth="1.3" />
        <circle cx="8" cy="8" r="1" fill={stroke} />
      </svg>
    );
  }
  if (type === "ranked") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.5z"
          stroke={stroke}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 3h11M2.5 8h11M2.5 13h7" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SignalMeter({ score, size = 44, strokeWidth = 3, fontSize = 12 }) {
  const radius = (size / 2) - strokeWidth * 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score ?? 0)) / 100;
  const offset = circumference - pct * circumference;
  const color =
    !score ? "var(--danger)" :
    score >= 70 ? "var(--strong)" :
    score >= 40 ? "var(--moderate)" : "var(--weak)";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: offset, transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace", fontSize, fontWeight: 500, color,
      }}>
        {score != null ? Math.round(score) : "–"}
      </span>
    </div>
  );
}

function SourceBadge({ source }) {
  if (!source) return null;
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)",
      border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", textTransform: "uppercase",
      letterSpacing: 0.5,
    }}>
      {source}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
      <div style={{
        width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%",
        border: "2px dashed var(--border)",
      }} />
      <p style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{text}</p>
    </div>
  );
}

function ContactInfo({ contact }) {
  const hasEmail = contact?.method === "email";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6, marginTop: 6,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: hasEmail ? "var(--strong)" : "var(--weak)",
      }} />
      {hasEmail ? (
        <span style={{ color: "var(--strong)" }}>{contact.value}</span>
      ) : (
        <span style={{ color: "var(--text-muted)" }}>No email — apply link only</span>
      )}
    </div>
  );
}

function ReasonChips({ reasons }) {
  if (!reasons?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {reasons.map((r, j) => (
        <span key={j} style={{
          fontSize: 12, color: "var(--text-muted)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "3px 10px",
        }}>
          {r}
        </span>
      ))}
    </div>
  );
}

// optional per-posting sub-scores (only rendered if the backend actually sends them)
function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const entries = Object.entries(breakdown);
  if (!entries.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
      {entries.map(([label, value]) => (
        <div key={label}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase",
            letterSpacing: 0.5, color: "var(--text-muted)", marginBottom: 4,
          }}>
            <span>{label.replace(/_/g, " ")}</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${Math.max(0, Math.min(100, value))}%`,
              background: "var(--accent, #8b5cf6)", borderRadius: 2,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- sidebar ----------

function Sidebar({ tab, setTab, counts, syncing, lastSynced }) {
  return (
    <aside style={{
      width: 232, flexShrink: 0, borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column", padding: "24px 16px", gap: 28,
      position: "sticky", top: 0, height: "100vh",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", border: "2px solid var(--border)",
          position: "relative", flexShrink: 0, overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "conic-gradient(from 0deg, transparent 0deg, var(--accent, #8b5cf6) 30deg, transparent 60deg)",
            animation: "sweep 3s linear infinite",
          }} />
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Gig Radar</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)",
            fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: syncing ? "var(--moderate)" : "var(--strong)",
            }} />
            {syncing ? "Syncing…" : lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : "Idle"}
          </div>
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {NAV.map(n => {
          const active = tab === n.key;
          return (
            <button
              key={n.key}
              onClick={() => setTab(n.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                border: active ? "1px solid var(--accent, #8b5cf6)" : "1px solid transparent",
                background: active ? "color-mix(in srgb, var(--accent, #8b5cf6) 14%, transparent)" : "transparent",
                color: active ? "var(--accent, #8b5cf6)" : "var(--text-muted)",
                fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: 14, textAlign: "left",
              }}
            >
              <NavIcon type={n.key} />
              <span style={{ flex: 1 }}>{n.label}</span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                opacity: 0.8,
                background: active ? "color-mix(in srgb, var(--accent, #8b5cf6) 22%, transparent)" : "var(--surface)",
                borderRadius: 10, padding: "1px 7px",
              }}>
                {counts[n.key]}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

// ---------- All Signals ----------

function RawList({ rawPostings }) {
  if (rawPostings === null) return <EmptyState text="Syncing signals…" />;
  if (rawPostings.length === 0) return <EmptyState text="No signals picked up yet. Run a scan to find gigs worth chasing." />;
  const sorted = [...rawPostings].sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0));
  return sorted.map((p, i) => (
    <div key={p.url ?? i} className="card" style={{ ...cardStyle, animation: `cardIn 0.3s ease ${i * 0.03}s both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <strong style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15 }}>{p.title}</strong>
        <SourceBadge source={p.source} />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.5 }}>
        {p.description ? `${p.description.slice(0, 180)}…` : "No description available."}
      </p>
      {timeAgo(p.posted_at) && (
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace" }}>
          {timeAgo(p.posted_at)}
        </span>
      )}
      <ContactInfo contact={p.contact} />
      <a href={p.url} target="_blank" rel="noreferrer" style={{ color: "var(--moderate)", fontSize: 13, textDecoration: "none" }}>
        View posting →
      </a>
    </div>
  ));
}

// ---------- Strong Matches ----------

function HeroCard({ post }) {
  return (
    <div style={{ ...cardStyle, borderColor: "var(--accent, #8b5cf6)", padding: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <SourceBadge source={post.source} />
            {timeAgo(post.posted_at) && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(post.posted_at)}</span>
            )}
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, margin: 0 }}>{post.title}</h2>
          {(post.rate_min || post.rate_max || post.hours_per_week) && (
            <div style={{
              display: "flex", gap: 10, marginTop: 6, fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13, color: "var(--moderate)",
            }}>
              {(post.rate_min || post.rate_max) && (
                <span>${post.rate_min ?? "?"}–{post.rate_max ?? "?"}/hr</span>
              )}
              {post.hours_per_week && <span>{post.hours_per_week}+ hrs/week</span>}
            </div>
          )}
        </div>
        <SignalMeter score={post.fit_score} size={52} fontSize={14} />
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginTop: 14 }}>
        {post.description}
      </p>

      <ReasonChips reasons={post.reasons} />
      <ContactInfo contact={post.contact} />

      <a
        href={post.url} target="_blank" rel="noreferrer"
        style={{ display: "inline-block", marginTop: 14, color: "var(--moderate)", fontSize: 13, textDecoration: "none" }}
      >
        View source →
      </a>
    </div>
  );
}

function OtherMatchRow({ post, onSelect }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
        border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, cursor: "pointer",
        background: "var(--surface)",
      }}
    >
      <SignalMeter score={post.fit_score} size={34} fontSize={11} strokeWidth={2.5} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500 }}>{post.title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{post.source}</div>
      </div>
    </div>
  );
}

function MatchPanel({ post }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...cardStyle, textAlign: "center", padding: 20 }}>
        <div style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)",
          fontFamily: "'JetBrains Mono', monospace", marginBottom: 14,
        }}>
          Match strength
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <SignalMeter score={post.fit_score} size={88} strokeWidth={5} fontSize={22} />
        </div>
        <ScoreBreakdown breakdown={post.score_breakdown} />
      </div>

      <div style={cardStyle}>
        <div style={{
          fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)",
          fontFamily: "'JetBrains Mono', monospace", marginBottom: 10,
        }}>
          Why it matched
        </div>
        {post.reasons?.length ? (
          <ReasonChips reasons={post.reasons} />
        ) : (
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No signal breakdown available for this posting.</p>
        )}
      </div>
    </div>
  );
}

function RankedView({ ranked, minScore, setMinScore }) {
  const [focusedUrl, setFocusedUrl] = useState(null);

  const sorted = useMemo(
    () => (ranked ?? []).filter(p => (p.fit_score ?? 0) >= minScore).sort((a, b) => (b.fit_score ?? 0) - (a.fit_score ?? 0)),
    [ranked, minScore]
  );
  const focused = sorted.find(p => p.url === focusedUrl) ?? sorted[0] ?? null;
  const others = sorted.filter(p => p !== focused);

  if (ranked === null) return <EmptyState text="Syncing signals…" />;
  if (sorted.length === 0) return <EmptyState text="Nothing cleared the threshold this run." />;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {focused && <HeroCard post={focused} />}
        {others.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', monospace", marginBottom: 10,
            }}>
              Other high scores
            </div>
            {others.map((p, i) => (
              <OtherMatchRow key={p.url ?? i} post={p} onSelect={() => setFocusedUrl(p.url)} />
            ))}
          </div>
        )}
      </div>
      <div style={{ width: 280, flexShrink: 0 }}>
        {focused && <MatchPanel post={focused} />}
      </div>
    </div>
  );
}

// ---------- Drafts ----------

function DraftListItem({ draft, active, onSelect }) {
  const decisionColor =
    draft.decision === "approve" ? "var(--strong)" :
    draft.decision === "discard" ? "var(--danger)" : "var(--weak)";
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "12px 14px", borderRadius: 10, marginBottom: 8, cursor: "pointer",
        border: active ? "1px solid var(--accent, #8b5cf6)" : "1px solid var(--border)",
        background: active ? "color-mix(in srgb, var(--accent, #8b5cf6) 10%, transparent)" : "var(--surface)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, textTransform: "uppercase",
          color: decisionColor, letterSpacing: 0.5,
        }}>
          {draft.decision ?? "pending"}
        </span>
        {draft.fit_score != null && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>
            {Math.round(draft.fit_score)}%
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 500, marginTop: 4 }}>
        {draft.title}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{draft.source}</div>
    </div>
  );
}

function EditorToolbar({ textareaRef, onChange }) {
  const wrap = (before, after = before) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const selected = value.slice(selectionStart, selectionEnd);
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selectionStart + before.length, selectionEnd + before.length);
    });
  };

  const bulletize = () => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const before = value.slice(0, lineStart);
    const target = value.slice(lineStart, selectionEnd);
    const bulleted = target.split("\n").map(l => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
    onChange(before + bulleted + value.slice(selectionEnd));
    el.focus();
  };

  const btnStyle = {
    width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
    border: "1px solid var(--border)", borderRadius: 6, background: "transparent",
    color: "var(--text-muted)", cursor: "pointer", fontSize: 13,
  };

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
      <button type="button" style={{ ...btnStyle, fontWeight: 700 }} onClick={() => wrap("**")}>B</button>
      <button type="button" style={{ ...btnStyle, fontStyle: "italic" }} onClick={() => wrap("_")}>I</button>
      <button type="button" style={{ ...btnStyle, textDecoration: "underline" }} onClick={() => wrap("<u>", "</u>")}>U</button>
      <button type="button" style={btnStyle} onClick={bulletize}>•≡</button>
    </div>
  );
}

function DraftEditor({ draft, onFieldChange, onSave }) {
  const textareaRef = useRef(null);
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`${API}/drafts/${encodeURIComponent(draft.url)}/regenerate`, { method: "POST" });
      if (res.ok) {
        const updated = await res.json();
        if (updated?.edited_pitch != null) onFieldChange("edited_pitch", updated.edited_pitch);
      }
    } catch {
      // regeneration endpoint not available yet — no-op
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, margin: 0 }}>{draft.title}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
            <SourceBadge source={draft.source} />
            <span style={{
              fontSize: 11, color: "var(--text-muted)", fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              AI drafted
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={regenerate}
            disabled={regenerating}
            style={{
              fontSize: 13, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            {regenerating ? "Regenerating…" : "↻ Regenerate"}
          </button>
        </div>
      </div>

      {draft.email && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginTop: 12,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--strong)", flexShrink: 0 }} />
          <span style={{ color: "var(--strong)" }}>{draft.email}</span>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <EditorToolbar textareaRef={textareaRef} onChange={(v) => onFieldChange("edited_pitch", v)} />
        <textarea
          ref={textareaRef}
          value={draft.edited_pitch ?? ""}
          onChange={(e) => onFieldChange("edited_pitch", e.target.value)}
          style={{
            width: "100%", minHeight: 260, background: "var(--bg)", color: "var(--text)",
            border: "1px solid var(--border)", borderRadius: 8, padding: 14, fontSize: 14, lineHeight: 1.6,
            fontFamily: "'Inter', sans-serif", resize: "vertical",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
        <button
          onClick={() => onFieldChange("decision", "discard")}
          style={{
            fontSize: 13, padding: "8px 16px", borderRadius: 6,
            border: `1px solid ${draft.decision === "discard" ? "var(--danger)" : "var(--border)"}`,
            background: draft.decision === "discard" ? "color-mix(in srgb, var(--danger) 18%, transparent)" : "transparent",
            color: draft.decision === "discard" ? "var(--danger)" : "var(--text-muted)", cursor: "pointer",
          }}
        >
          Discard
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onSave}
            style={{
              fontSize: 13, padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-muted)", cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            onClick={() => onFieldChange("decision", "approve")}
            style={{
              fontSize: 13, fontWeight: 500, padding: "8px 18px", borderRadius: 6, border: "none",
              background: "var(--accent, #8b5cf6)", color: "#fff", cursor: "pointer",
            }}
          >
            Send pitch
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftsView({ drafts, updateDraft, saveDraft }) {
  const [focusedUrl, setFocusedUrl] = useState(null);
  const focused = drafts?.find(d => d.url === focusedUrl) ?? drafts?.[0] ?? null;

  if (drafts === null) return <EmptyState text="Syncing signals…" />;
  if (drafts.length === 0) return <EmptyState text="No drafts waiting on you." />;

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        {drafts.map((d, i) => (
          <DraftListItem
            key={d.url ?? i}
            draft={d}
            active={focused?.url === d.url}
            onSelect={() => setFocusedUrl(d.url)}
          />
        ))}
      </div>
      {focused && (
        <DraftEditor
          draft={focused}
          onFieldChange={(field, value) => updateDraft(focused.url, field, value)}
          onSave={() => saveDraft(focused)}
        />
      )}
    </div>
  );
}

// ---------- app ----------

function App() {
  const [tab, setTab] = useState("raw");
  const [rawPostings, setRawPostings] = useState(null);
  const [ranked, setRanked] = useState(null);
  const [drafts, setDrafts] = useState(null);
  const [lastSynced, setLastSynced] = useState(null);
  const [syncing, setSyncing] = useState(true);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    setSyncing(true);
    Promise.all([
      fetch(`${API}/raw-postings`).then(r => r.json()),
      fetch(`${API}/ranked-postings`).then(r => r.json()),
      fetch(`${API}/drafts`).then(r => r.json()),
    ]).then(([raw, rank, draft]) => {
      setRawPostings(raw);
      setRanked(rank);
      setDrafts(draft);
      setLastSynced(new Date());
      setSyncing(false);
    });
  }, []);

  const updateDraft = (url, field, value) => {
    setDrafts(prev => prev.map(d => (d.url === url ? { ...d, [field]: value } : d)));
  };

  const saveDraft = async (draft) => {
    await fetch(`${API}/drafts/${encodeURIComponent(draft.url)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: draft.decision, edited_pitch: draft.edited_pitch }),
    });
  };

  const counts = { raw: rawPostings?.length ?? 0, ranked: ranked?.length ?? 0, drafts: drafts?.length ?? 0 };

  const headers = {
    raw: {
      title: "All Signals",
      subtitle: rawPostings ? `${rawPostings.length} signal${rawPostings.length === 1 ? "" : "s"} picked up from your sources.` : "Loading…",
    },
    ranked: {
      title: "Strong Matches",
      subtitle: ranked ? `${ranked.filter(p => (p.fit_score ?? 0) >= minScore).length} opportunit${ranked.filter(p => (p.fit_score ?? 0) >= minScore).length === 1 ? "y" : "ies"} matching your profile.` : "Loading…",
    },
    drafts: {
      title: "Drafts",
      subtitle: drafts ? `${drafts.filter(d => (d.decision ?? "pending") === "pending").length} pitch${drafts.filter(d => (d.decision ?? "pending") === "pending").length === 1 ? "" : "es"} waiting for review.` : "Loading…",
    },
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar tab={tab} setTab={setTab} counts={counts} syncing={syncing} lastSynced={lastSynced} />

      <main style={{ flex: 1, minWidth: 0, padding: "40px 44px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: 0, fontWeight: 700 }}>
              {headers[tab].title}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{headers[tab].subtitle}</p>
          </div>

          {tab === "ranked" && (
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12, background: "var(--surface)",
                color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px",
              }}
            >
              <option value={0}>Score &gt; 0%</option>
              <option value={40}>Score &gt; 40%</option>
              <option value={70}>Score &gt; 70%</option>
              <option value={85}>Score &gt; 85%</option>
            </select>
          )}
        </div>

        {tab === "raw" && <RawList rawPostings={rawPostings} />}
        {tab === "ranked" && <RankedView ranked={ranked} minScore={minScore} setMinScore={setMinScore} />}
        {tab === "drafts" && <DraftsView drafts={drafts} updateDraft={updateDraft} saveDraft={saveDraft} />}
      </main>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 18,
  marginBottom: 14,
};

export default App;