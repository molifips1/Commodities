import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ──────────────────────────────────────────────────────────────────
const API = "http://localhost:5000/api";
const POLL_MS = 800;

// ─── Sparkline Canvas ─────────────────────────────────────────────────────────
function Sparkline({ data, width = 600, height = 80 }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || data.length < 2) return;
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data) * 0.999;
    const max = Math.max(...data) * 1.001;
    const range = max - min || 1;

    const xs = (i) => (i / (data.length - 1)) * width;
    const ys = (v) => height - ((v - min) / range) * (height - 4) - 2;

    // Grid lines
    ctx.strokeStyle = "rgba(255,177,0,0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = (i / 4) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    const up = data[data.length - 1] >= data[0];
    grad.addColorStop(0, up ? "rgba(0,255,0,0.25)" : "rgba(255,0,0,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(xs(0), height);
    data.forEach((v, i) => ctx.lineTo(xs(i), ys(v)));
    ctx.lineTo(xs(data.length - 1), height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = up ? "#00FF00" : "#FF0000";
    data.forEach((v, i) => (i === 0 ? ctx.moveTo(xs(i), ys(v)) : ctx.lineTo(xs(i), ys(v))));
    ctx.stroke();

    // Current price dot
    const lastX = xs(data.length - 1);
    const lastY = ys(data[data.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
    ctx.fillStyle = up ? "#00FF00" : "#FF0000";
    ctx.fill();
  }, [data, width, height]);

  return <canvas ref={ref} width={width} height={height} style={{ width: "100%", height }} />;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt4 = (n) => (n ?? 0).toFixed(4);
const fmt2 = (n) => (n ?? 0).toFixed(2);

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function phaseBadge(phase) {
  if (phase === "OPEN")
    return <span style={{ color: "#00FF00", border: "1px solid #00FF00", padding: "1px 8px", fontSize: 11 }}>● OPEN</span>;
  if (phase === "LOCKED")
    return <span style={{ color: "#FFB100", border: "1px solid #FFB100", padding: "1px 8px", fontSize: 11 }}>⬡ LOCKED</span>;
  return <span style={{ color: "#FF4444", border: "1px solid #FF4444", padding: "1px 8px", fontSize: 11 }}>■ RESOLVED</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CopperTerminal() {
  const [state, setState] = useState(null);
  const [betAmount, setBetAmount] = useState("10");
  const [betMsg, setBetMsg] = useState("");
  const [betMsgColor, setBetMsgColor] = useState("#00FF00");
  const logRef = useRef(null);

  // Poll backend
  useEffect(() => {
    let id;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/state`);
        const data = await res.json();
        setState(data);
      } catch {
        setBetMsg("⚠ BACKEND OFFLINE — RUN app.py");
        setBetMsgColor("#FF4444");
      }
    };
    poll();
    id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [state?.log]);

  const placeBet = useCallback(async (side) => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) {
      setBetMsg("⚠ Enter a valid amount");
      setBetMsgColor("#FFB100");
      return;
    }
    try {
      const res = await fetch(`${API}/bet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, amount }),
      });
      const data = await res.json();
      if (data.error) {
        setBetMsg(`⚠ ${data.error}`);
        setBetMsgColor("#FF4444");
      } else {
        setBetMsg(`✓ ${side} $${fmt2(amount)} confirmed`);
        setBetMsgColor("#00FF00");
      }
    } catch {
      setBetMsg("⚠ Network error");
      setBetMsgColor("#FF4444");
    }
    setTimeout(() => setBetMsg(""), 3000);
  }, [betAmount]);

  const s = state;
  const up = s ? s.live_price >= s.start_price : true;
  const priceDelta = s ? s.live_price - s.start_price : 0;
  const priceDeltaPct = s && s.start_price ? (priceDelta / s.start_price) * 100 : 0;
  const totalPool = s ? s.pool_long + s.pool_short : 0;
  const longPct = totalPool > 0 ? (s.pool_long / totalPool) * 100 : 50;
  const shortPct = 100 - longPct;

  const mono = "'Consolas','Monaco','Courier New',monospace";

  const styles = {
    root: {
      background: "#000",
      color: "#FFB100",
      fontFamily: mono,
      minHeight: "100vh",
      padding: "0 0 24px",
      fontSize: 13,
    },
    // Command bar
    cmdBar: {
      background: "#003399",
      color: "#fff",
      padding: "4px 16px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: 13,
      letterSpacing: 1,
    },
    // Sub-header
    subBar: {
      background: "#001155",
      color: "#aac4ff",
      padding: "2px 16px",
      display: "flex",
      gap: 24,
      fontSize: 11,
      borderBottom: "1px solid #003399",
    },
    panel: {
      border: "1px solid #333",
      padding: "10px 14px",
      background: "#050505",
    },
    sectionTitle: {
      color: "#fff",
      background: "#003399",
      padding: "2px 8px",
      fontSize: 11,
      letterSpacing: 1,
      marginBottom: 10,
      display: "inline-block",
    },
    dataRow: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 4,
      fontSize: 12,
    },
    label: { color: "#888" },
    val: { color: "#FFB100" },
    green: { color: "#00FF00" },
    red: { color: "#FF0000" },
    bigPrice: {
      fontSize: 32,
      fontFamily: mono,
      color: up ? "#00FF00" : "#FF0000",
      letterSpacing: 2,
    },
  };

  return (
    <div style={styles.root}>
      {/* ── Command Bar ── */}
      <div style={styles.cmdBar}>
        <span>CPPR &lt;GO&gt; &nbsp;|&nbsp; XCU/USD COPPER PREDICTION MARKET</span>
        <span style={{ fontSize: 11 }}>
          {new Date().toLocaleTimeString("en-US", { hour12: false })} &nbsp;|&nbsp;
          ROUND #{s?.round_id ?? "—"} &nbsp;|&nbsp; {phaseBadge(s?.phase ?? "—")}
        </span>
      </div>

      {/* ── Sub Bar ── */}
      <div style={styles.subBar}>
        <span>COMMOD: COPPER</span>
        <span>EXCH: COMEX</span>
        <span>CCY: USD</span>
        <span>UNIT: LB</span>
        <span>PREV CLOSE: {s ? fmt4(s.start_price) : "—"}</span>
        <span style={{ marginLeft: "auto" }}>BLOOMBERG TERMINAL v9.4.1</span>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 2, padding: "2px 2px 0" }}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Price Hero */}
          <div style={{ ...styles.panel, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>XCU/USD LIVE</div>
                <div style={styles.bigPrice}>${s ? fmt4(s.live_price) : "0.0000"}</div>
              </div>
              <div style={{ paddingBottom: 6 }}>
                <div
                  style={{
                    fontSize: 18,
                    color: priceDelta >= 0 ? "#00FF00" : "#FF0000",
                    fontFamily: mono,
                  }}
                >
                  {priceDelta >= 0 ? "▲" : "▼"} {Math.abs(priceDelta).toFixed(4)} (
                  {priceDeltaPct.toFixed(3)}%)
                </div>
                <div style={{ fontSize: 11, color: "#666" }}>vs ROUND START</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#888" }}>TIME REMAINING</div>
                <div
                  style={{
                    fontSize: 28,
                    fontFamily: mono,
                    color: s?.phase === "LOCKED" ? "#FF4444" : "#FFB100",
                  }}
                >
                  {s ? fmtTime(s.time_remaining) : "--:--"}
                </div>
                <div style={{ fontSize: 11 }}>{s?.phase ?? "—"}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 10, height: 4, background: "#111", position: "relative" }}>
              <div
                style={{
                  height: "100%",
                  width: `${s ? ((300 - s.time_remaining) / 300) * 100 : 0}%`,
                  background: s?.phase === "LOCKED" ? "#FF4444" : "#FFB100",
                  transition: "width 0.5s linear",
                }}
              />
            </div>
          </div>

          {/* Chart */}
          <div style={{ ...styles.panel }}>
            <div style={styles.sectionTitle}>PRICE CHART — XCU/USD (2s ticks)</div>
            <Sparkline data={s?.price_history ?? [4.12]} width={900} height={90} />
            <div
              style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555", marginTop: 4 }}
            >
              <span>T-{(s?.price_history?.length ?? 0) * 2}s</span>
              <span>NOW</span>
            </div>
          </div>

          {/* Round Stats */}
          <div style={{ ...styles.panel }}>
            <div style={styles.sectionTitle}>CURRENT ROUND STATS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[
                ["ROUND #", s?.round_id ?? "—"],
                ["START PRICE", s ? `$${fmt4(s.start_price)}` : "—"],
                ["LIVE PRICE", s ? `$${fmt4(s.live_price)}` : "—"],
                ["TOTAL POOL", s ? `$${fmt2(totalPool)}` : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ border: "1px solid #222", padding: "8px 10px" }}>
                  <div style={{ fontSize: 10, color: "#666" }}>{k}</div>
                  <div style={{ fontSize: 16, color: "#FFB100" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Pool bars */}
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={styles.green}>LONG ${fmt2(s?.pool_long ?? 0)} ({longPct.toFixed(1)}%)</span>
                <span style={styles.red}>SHORT ${fmt2(s?.pool_short ?? 0)} ({shortPct.toFixed(1)}%)</span>
              </div>
              <div style={{ height: 8, background: "#FF0000", position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    height: "100%",
                    width: `${longPct}%`,
                    background: "#00FF00",
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Last Result */}
          {s?.last_result && (
            <div style={{ ...styles.panel, borderColor: "#333" }}>
              <div style={styles.sectionTitle}>LAST SETTLED ROUND — #{s.last_result.round_id}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, fontSize: 12 }}>
                {[
                  ["START", `$${fmt4(s.last_result.start_price)}`],
                  ["END", `$${fmt4(s.last_result.end_price)}`],
                  ["RESULT", s.last_result.direction],
                  ["POOL", `$${fmt2(s.last_result.total_pool)}`],
                  ["PAYOUT", `${s.last_result.payout_multiplier}x`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: "#555" }}>{k}</div>
                    <div
                      style={{
                        color:
                          v === "LONG" ? "#00FF00" : v === "SHORT" ? "#FF0000" : "#FFB100",
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Trade Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Trade Box */}
          <div style={{ ...styles.panel, flex: "0 0 auto" }}>
            <div style={styles.sectionTitle}>TRADE PANEL</div>

            <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>STAKE (USD)</div>
            <input
              type="number"
              min="1"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              style={{
                width: "100%",
                background: "#0a0a0a",
                border: "1px solid #FFB100",
                color: "#FFB100",
                fontFamily: mono,
                fontSize: 18,
                padding: "6px 10px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
            />

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {["5", "10", "25", "100"].map((v) => (
                <button
                  key={v}
                  onClick={() => setBetAmount(v)}
                  style={{
                    flex: 1,
                    background: betAmount === v ? "#FFB100" : "#111",
                    color: betAmount === v ? "#000" : "#FFB100",
                    border: "1px solid #333",
                    fontFamily: mono,
                    fontSize: 11,
                    padding: "3px 0",
                    cursor: "pointer",
                  }}
                >
                  ${v}
                </button>
              ))}
            </div>

            {/* Long / Short buttons */}
            <button
              onClick={() => placeBet("LONG")}
              disabled={s?.phase !== "OPEN"}
              style={{
                width: "100%",
                padding: "14px",
                background: s?.phase === "OPEN" ? "#003300" : "#111",
                color: s?.phase === "OPEN" ? "#00FF00" : "#555",
                border: `2px solid ${s?.phase === "OPEN" ? "#00FF00" : "#333"}`,
                fontFamily: mono,
                fontSize: 16,
                letterSpacing: 3,
                cursor: s?.phase === "OPEN" ? "pointer" : "not-allowed",
                marginBottom: 6,
                transition: "all 0.15s",
              }}
            >
              ▲ LONG
            </button>
            <button
              onClick={() => placeBet("SHORT")}
              disabled={s?.phase !== "OPEN"}
              style={{
                width: "100%",
                padding: "14px",
                background: s?.phase === "OPEN" ? "#330000" : "#111",
                color: s?.phase === "OPEN" ? "#FF4444" : "#555",
                border: `2px solid ${s?.phase === "OPEN" ? "#FF4444" : "#333"}`,
                fontFamily: mono,
                fontSize: 16,
                letterSpacing: 3,
                cursor: s?.phase === "OPEN" ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              ▼ SHORT
            </button>

            {betMsg && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  border: `1px solid ${betMsgColor}`,
                  color: betMsgColor,
                  fontSize: 11,
                }}
              >
                {betMsg}
              </div>
            )}

            {s?.phase !== "OPEN" && (
              <div
                style={{
                  marginTop: 8,
                  padding: "6px 10px",
                  background: "#1a0a00",
                  border: "1px solid #FF8800",
                  color: "#FF8800",
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                {s?.phase === "LOCKED"
                  ? "⬡ BETTING LOCKED — AWAITING RESOLUTION"
                  : "■ RESOLVING ROUND..."}
              </div>
            )}
          </div>

          {/* Market Info */}
          <div style={{ ...styles.panel, flex: "0 0 auto" }}>
            <div style={styles.sectionTitle}>MARKET INFO</div>
            {[
              ["CONTRACT", "XCU/USD"],
              ["EXCHANGE", "COMEX"],
              ["ROUND LEN", "5:00 MIN"],
              ["LOCK PHASE", "1:00 MIN"],
              ["MIN BET", "$1.00"],
              ["SETTLEMENT", "LIVE PRICE"],
            ].map(([k, v]) => (
              <div key={k} style={styles.dataRow}>
                <span style={styles.label}>{k}</span>
                <span style={styles.val}>{v}</span>
              </div>
            ))}
          </div>

          {/* Phase Guide */}
          <div style={{ ...styles.panel, flex: "0 0 auto", fontSize: 11 }}>
            <div style={styles.sectionTitle}>PHASE GUIDE</div>
            <div style={{ marginBottom: 6 }}>
              <span style={styles.green}>● OPEN</span>
              <span style={{ color: "#888" }}> — 0:00 → 4:00 | Bets accepted</span>
            </div>
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "#FFB100" }}>⬡ LOCKED</span>
              <span style={{ color: "#888" }}> — 4:00 → 5:00 | No new bets</span>
            </div>
            <div>
              <span style={styles.red}>■ RESOLVED</span>
              <span style={{ color: "#888" }}> — Winners paid, new round starts</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Terminal Log ── */}
      <div style={{ margin: "2px 2px 0", ...styles.panel, height: 160 }}>
        <div style={styles.sectionTitle}>TERMINAL LOG</div>
        <div
          ref={logRef}
          style={{
            height: 110,
            overflowY: "auto",
            fontSize: 11,
            lineHeight: 1.7,
            color: "#00CC00",
          }}
        >
          {(s?.log ?? []).map((line, i) => (
            <div key={i}>
              <span style={{ color: "#555" }}>&gt; </span>
              {line}
            </div>
          ))}
          {!s && (
            <div style={{ color: "#FF4444" }}>
              &gt; ⚠ CONNECTING TO BACKEND — ensure app.py is running on port 5000
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          margin: "2px 2px 0",
          background: "#001",
          borderTop: "1px solid #003399",
          padding: "2px 12px",
          fontSize: 10,
          color: "#555",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>BLOOMBERG PROFESSIONAL SERVICE © 2025 — SIMULATION ONLY</span>
        <span>{s ? "● CONNECTED" : "○ DISCONNECTED"}</span>
      </div>
    </div>
  );
}
