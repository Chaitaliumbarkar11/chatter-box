import { useState, useEffect } from "react";
import socket from "../socket";

const SETTINGS_KEY = "chatterbox_settings";

export const defaultSettings = {
  notifications: true,
  soundAlerts: true,
  readReceipts: true,
  onlineStatus: true,
  typingIndicator: true,
  enterToSend: true,
  fontSize: "medium",
  theme: "galactic", // "galactic" | "dark" | "neon"
};

// ── Theme definitions ─────────────────────────────────────────────────────
export const THEMES = {
  galactic: {
    name: "🌌 Galactic",
    bg: "linear-gradient(135deg, #0a0517 0%, #1a0f2e 50%, #0d0b1a 100%)",
    accent: "#85C2FF",
    accentAlt: "#4da6ff",
    msgLeft: "linear-gradient(135deg, rgba(133,194,255,0.22), rgba(77,166,255,0.16))",
    msgRight: "linear-gradient(135deg, hsla(184,100%,50%,0.25), rgba(0,255,255,0.18))",
    sidebar: "rgba(17,17,17,0.98)",
    chatBg: "rgba(13,11,26,0.98)",
    inputBg: "rgba(26,26,34,0.95)",
  },
  dark: {
    name: "🖤 Dark Mode",
    bg: "linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #111111 100%)",
    accent: "#a0a0a0",
    accentAlt: "#787878",
    msgLeft: "linear-gradient(135deg, rgba(160,160,160,0.18), rgba(120,120,120,0.12))",
    msgRight: "linear-gradient(135deg, rgba(80,80,80,0.35), rgba(60,60,60,0.25))",
    sidebar: "rgba(10,10,10,0.99)",
    chatBg: "rgba(15,15,15,0.99)",
    inputBg: "rgba(20,20,20,0.97)",
  },
  neon: {
    name: "💚 Neon Green",
    bg: "linear-gradient(135deg, #001a00 0%, #002800 50%, #001200 100%)",
    accent: "#00ff88",
    accentAlt: "#00cc66",
    msgLeft: "linear-gradient(135deg, rgba(0,255,136,0.18), rgba(0,204,102,0.12))",
    msgRight: "linear-gradient(135deg, rgba(0,255,136,0.28), rgba(0,180,80,0.2))",
    sidebar: "rgba(0,15,0,0.99)",
    chatBg: "rgba(0,10,0,0.99)",
    inputBg: "rgba(0,20,0,0.97)",
  },
};

// ── Helper to get saved settings anywhere ─────────────────────────────────
export function getSetting(key) {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return s[key] !== undefined ? s[key] : defaultSettings[key];
  } catch {
    return defaultSettings[key];
  }
}

export function getTheme() {
  const t = getSetting("theme");
  return THEMES[t] || THEMES.galactic;
}

export default function Settings() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [saved, setSaved] = useState(false);

  // Persist every change immediately
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const toggle = (key) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === "onlineStatus") {
        const currentUser = JSON.parse(localStorage.getItem("user"));
        if (currentUser) {
          socket.emit("status_change", {
            userId: currentUser._id,
            status: next.onlineStatus ? "online" : "invisible",
          });
        }
      }
      return next;
    });
    flashSaved();
  };

  const set = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClearHistory = () => {
    if (window.confirm("Clear all local message history? This cannot be undone.")) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("msgs_"))
        .forEach((k) => localStorage.removeItem(k));
      alert("Chat history cleared.");
    }
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        "⚠️ Are you absolutely sure? This will permanently delete your account."
      )
    ) {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user"));
      fetch(`http://localhost:5001/api/auth/delete-account/${user._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(() => {
          localStorage.clear();
          socket.disconnect();
          window.location.href = "/auth";
        })
        .catch(() => alert("Failed to delete account. Try again."));
    }
  };

  const theme = THEMES[settings.theme] || THEMES.galactic;

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        background: on
          ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`
          : "rgba(133,194,255,0.2)",
        border: "none",
        position: "relative",
        cursor: "pointer",
        transition: "background 0.3s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          top: "3px",
          left: on ? "23px" : "3px",
          transition: "left 0.3s",
          boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );

  const Section = ({ title }) => (
    <div
      style={{
        fontSize: "11px",
        letterSpacing: "2px",
        color: `${theme.accent}80`,
        textTransform: "uppercase",
        margin: "28px 0 12px",
      }}
    >
      {title}
    </div>
  );

  const Row = ({ icon, label, desc, right, danger = false, onClick }) => (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 20px",
        borderRadius: "14px",
        border: `1px solid ${danger ? "rgba(255,71,87,0.2)" : `${theme.accent}20`}`,
        background: danger ? "rgba(255,71,87,0.03)" : "rgba(26,26,34,0.7)",
        marginBottom: "10px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: danger ? "rgba(255,71,87,0.12)" : `${theme.accent}20`,
            border: `1px solid ${danger ? "rgba(255,71,87,0.2)" : `${theme.accent}30`}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: "15px", fontWeight: 500, color: danger ? "#ff6b6b" : "#fff" }}>
            {label}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
            {desc}
          </div>
        </div>
      </div>
      {right}
    </div>
  );

  return (
    <div
      style={{
        flex: 1,
        padding: "40px",
        overflowY: "auto",
        fontFamily: "'Orbitron', -apple-system, sans-serif",
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          paddingBottom: "24px",
          borderBottom: `1px solid ${theme.accent}25`,
          marginBottom: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ color: theme.accent, fontSize: "22px", fontWeight: 700, margin: 0 }}>
          ⚙️ Settings
        </h2>
        {saved && (
          <span
            style={{
              fontSize: "13px",
              color: "#00ff88",
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.3)",
              borderRadius: "20px",
              padding: "4px 14px",
            }}
          >
            ✓ Saved
          </span>
        )}
      </div>

      {/* NOTIFICATIONS */}
      <Section title="Notifications" />
      <Row
        icon="🔔"
        label="Message Notifications"
        desc="Get notified for new messages"
        right={<Toggle on={settings.notifications} onClick={() => toggle("notifications")} />}
      />
      <Row
        icon="🔊"
        label="Sound Alerts"
        desc="Play sound on new message"
        right={<Toggle on={settings.soundAlerts} onClick={() => toggle("soundAlerts")} />}
      />

      {/* PRIVACY */}
      <Section title="Privacy" />
      <Row
        icon="✅"
        label="Read Receipts"
        desc="Show blue ticks when messages are read"
        right={<Toggle on={settings.readReceipts} onClick={() => toggle("readReceipts")} />}
      />
      <Row
        icon="👤"
        label="Online Status"
        desc="Let others see when you're online"
        right={<Toggle on={settings.onlineStatus} onClick={() => toggle("onlineStatus")} />}
      />
      <Row
        icon="✏️"
        label="Typing Indicator"
        desc="Show when you're typing"
        right={<Toggle on={settings.typingIndicator} onClick={() => toggle("typingIndicator")} />}
      />

      {/* APPEARANCE */}
      <Section title="Appearance" />

      {/* Theme selector */}
      <div
        style={{
          padding: "18px 20px",
          borderRadius: "14px",
          border: `1px solid ${theme.accent}20`,
          background: "rgba(26,26,34,0.7)",
          marginBottom: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
          <div
            style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: `${theme.accent}20`,
              border: `1px solid ${theme.accent}30`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
            }}
          >
            🎨
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 500, color: "#fff" }}>Theme</div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "2px" }}>
              Choose your chat appearance
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {Object.entries(THEMES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => set("theme", key)}
              style={{
                flex: 1,
                minWidth: "100px",
                padding: "10px 14px",
                borderRadius: "12px",
                border: `2px solid ${settings.theme === key ? t.accent : "rgba(255,255,255,0.1)"}`,
                background:
                  settings.theme === key
                    ? `${t.accent}20`
                    : "rgba(255,255,255,0.04)",
                color: settings.theme === key ? t.accent : "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: settings.theme === key ? 700 : 400,
                transition: "all 0.2s",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <Row
        icon="🔤"
        label="Message Font Size"
        desc="Adjust chat text size"
        right={
          <select
            value={settings.fontSize}
            onChange={(e) => set("fontSize", e.target.value)}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: `${theme.accent}20`,
              border: `1px solid ${theme.accent}50`,
              borderRadius: "20px",
              color: theme.accent,
              padding: "6px 14px",
              fontSize: "13px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        }
      />
      <Row
        icon="⏎"
        label="Enter to Send"
        desc="Press Enter to send messages"
        right={<Toggle on={settings.enterToSend} onClick={() => toggle("enterToSend")} />}
      />

      {/* ACCOUNT */}
      <Section title="Account" />
      <Row
        icon="🗑️"
        label="Clear Chat History"
        desc="Delete all local messages"
        danger
        onClick={handleClearHistory}
        right={<span style={{ color: "rgba(255,107,107,0.6)", fontSize: "20px" }}>›</span>}
      />
      <Row
        icon="🔒"
        label="Delete Account"
        desc="Permanently remove your account"
        danger
        onClick={handleDeleteAccount}
        right={<span style={{ color: "rgba(255,107,107,0.6)", fontSize: "20px" }}>›</span>}
      />

      <div
        style={{
          marginTop: "32px",
          textAlign: "center",
          fontSize: "12px",
          color: `${theme.accent}50`,
        }}
      >
        ChatterBox v2.0.0 · Galactic Edition
      </div>
    </div>
  );
}