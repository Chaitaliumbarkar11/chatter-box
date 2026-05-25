import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Profile from "./Profile";
import AddContact from "./AddContact";
import Settings, { getTheme, getSetting } from "./Settings";
import socket from "../socket";
import "../style/Dashbord.css";

// ── tiny notification sound via Web Audio API ─────────────────────────────
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}
const API_BASE = "https://chatter-box-1-1qc6.onrender.com";
// ── Format lastSeen nicely ────────────────────────────────────────────────
function formatLastSeen(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;
  if (diffHr < 24) return `last seen ${diffHr}h ago`;
  if (diffDay === 1) return `last seen yesterday at ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return `last seen ${d.toLocaleDateString([], { day: "numeric", month: "short" })}`;
}

// ── Format file size ──────────────────────────────────────────────────────
function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏", "🙌", "💯"];

export default function Dashboard() {
  
  const typingTimeout = useRef(null);
  const navigate = useNavigate();
  const storedUser = localStorage.getItem("user");
  const currentUser = storedUser ? JSON.parse(storedUser) : null;

  // ── theme (re-reads on settings change) ──────────────────────────────
  const [theme, setTheme] = useState(getTheme());
  const [fontSize, setFontSize] = useState(getSetting("fontSize"));

  // ── core state ────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedView, setSelectedView] = useState("chat");

  // ── WhatsApp features state ───────────────────────────────────────────
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState({});
  const [hoverMsg, setHoverMsg] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [chatSearch, setChatSearch] = useState("");
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  // ── refresh theme when switching back to chat from settings ───────────
  useEffect(() => {
    if (selectedView === "chat") {
      setTheme(getTheme());
      setFontSize(getSetting("fontSize"));
    }
  }, [selectedView]);

  // Dashboard.js mein getNotifPref replace karo
const getNotifPref = (key) => {
  try {
    const s = JSON.parse(localStorage.getItem("chatterbox_settings") || "{}");
    const defaults = { notifications: true, soundAlerts: true, readReceipts: true, onlineStatus: true, typingIndicator: true, enterToSend: true };
    return s[key] !== undefined ? s[key] : (defaults[key] !== undefined ? defaults[key] : true);
  } catch { return true; }
};

  // ── refs ──────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const docInputRef = useRef(null); 
  const selectedUserRef = useRef(null);
  const pendingMsgIds = useRef(new Set());

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // ── auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/auth");
  }, []);

  // ── socket connect + load contacts ────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    socket.connect();
    socket.emit("join", currentUser._id);

  fetch(`${API_BASE}/api/auth/contacts/${currentUser._id}`)
      .then((r) => r.json())
      .then(({ success, contacts }) => {
        if (!success || !contacts?.length) return;
        setUsers(
          contacts.map((c) => ({
            _id: c._id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            avatar: c.avatar || null,
            status: "offline",
            lastSeen: null,
            lastMessage: "",
            time: "",
            unread: 0,
            initials: c.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase(),
          }))
        );
      })
      .catch(console.error);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  // ── online users ──────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("online_users", (ids) =>
      setUsers((p) =>
        p.map((u) => ({
          ...u,
          status: ids.includes(String(u._id)) ? "online" : "offline",
        }))
      )
    );
    return () => socket.off("online_users");
  }, []);

  // ── status change (now includes lastSeen) ─────────────────────────────
  useEffect(() => {
    socket.on("status_change", ({ userId, status, lastSeen }) => {
      setUsers((p) =>
        p.map((u) =>
          String(u._id) === String(userId)
            ? { ...u, status, ...(lastSeen ? { lastSeen } : {}) }
            : u
        )
      );
      setSelectedUser((p) =>
        p && String(p._id) === String(userId)
          ? { ...p, status, ...(lastSeen ? { lastSeen } : {}) }
          : p
      );
    });
    return () => socket.off("status_change");
  }, []);

  // ── typing indicator ──────────────────────────────────────────────────
  useEffect(() => {
    socket.on("typing", ({ userId, typing }) => {
      setUsers((p) =>
        p.map((u) =>
          String(u._id) === String(userId)
            ? { ...u, status: typing ? "typing" : "online" }
            : u
        )
      );
      setSelectedUser((p) => {
        if (!p || String(p._id) !== String(userId)) return p;
        return { ...p, status: typing ? "typing" : "online" };
      });
    });
    return () => socket.off("typing");
  }, []);

  // ── new contact via socket ────────────────────────────────────────────
  useEffect(() => {
    socket.on("newContact", (contact) => {
      setUsers((p) => {
        if (p.find((u) => String(u._id) === String(contact._id))) return p;
        return [...p, contact];
      });
    });
    return () => socket.off("newContact");
  }, []);

  // ── READ RECEIPT: listen for "messages_read" from server ─────────────
  useEffect(() => {
    socket.on("messages_read", ({ byUserId, senderId }) => {
      // Mark all our sent messages to that user as read
      setMessages((prev) =>
        prev.map((m) =>
          String(m.senderId) === String(currentUser._id) &&
          (String(m.receiverId) === String(byUserId) ||
            String(byUserId) === String(m.receiverId))
            ? { ...m, read: true }
            : m
        )
      );
    });
    return () => socket.off("messages_read");
  }, []);

  // ── receive message ───────────────────────────────────────────────────
  useEffect(() => {
    const handleReceive = (msg) => {
      const msgId = msg._id?.toString();
      if (pendingMsgIds.current.has(msgId)) {
        pendingMsgIds.current.delete(msgId);
        return;
      }

      const sel = selectedUserRef.current;
      const isActive =
        sel &&
        (String(sel._id) === String(msg.senderId) ||
          String(sel._id) === String(msg.receiverId));

      if (isActive) {
        setMessages((prev) => {
          if (prev.find((m) => m._id?.toString() === msgId)) return prev;
          return [
            ...prev,
            {
              ...msg,
              sender:
                String(msg.senderId) === String(currentUser._id)
                  ? "right"
                  : "left",
              time:
                msg.time ||
                new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            },
          ];
        });

        // Auto mark as read since chat is open
        if (String(msg.senderId) !== String(currentUser._id)) {
          socket.emit("mark_read", {
            senderId: msg.senderId,
            receiverId: currentUser._id,
          });
        }
      }

      // Notification if not active chat
      
      if (
        !isActive &&
        String(msg.senderId) !== String(currentUser._id)
      ) {
        if (getNotifPref("soundEnabled")) playNotifSound();
        if (
          getNotifPref("desktopAlerts") &&
          Notification.permission === "granted"
        ) {
          const sender = users.find(
            (u) => String(u._id) === String(msg.senderId)
          );
          new Notification(
            `ChatterBox — ${sender?.name || "New message"}`,
            {
              body: getNotifPref("showPreviews") ? msg.text : "New message",
              icon: "/img/Screenshot (171).png",
            }
          );
        }
      }

      setUsers((prev) =>
        prev.map((u) => {
          const isParticipant =
            String(u._id) === String(msg.senderId) ||
            String(u._id) === String(msg.receiverId);
          if (!isParticipant) return u;
          const addUnread =
            !isActive &&
            String(msg.senderId) !== String(currentUser._id);

          let lastMsg = "📷 Photo";
          if (msg.file?.name) lastMsg = `📎 ${msg.file.name}`;
          else if (msg.text) lastMsg = msg.text;

          return {
            ...u,
            lastMessage: lastMsg,
            time:
              msg.time ||
              new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            unread: addUnread ? (u.unread || 0) + 1 : u.unread,
          };
        })
      );
    };

    socket.on("receive_message", handleReceive);
    return () => socket.off("receive_message");
  }, [users]);

  // ── chat history ──────────────────────────────────────────────────────
  useEffect(() => {
    socket.on("chat_history", (msgs) => {
      setMessages(
        msgs.map((msg) => ({
          ...msg,
          sender:
            String(msg.senderId) === String(currentUser._id)
              ? "right"
              : "left",
          time: new Date(msg.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }))
      );
    });
    return () => socket.off("chat_history");
  }, []);

  // ── join room on select ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser || !currentUser) return;
    setMessages([]);
    setReplyTo(null);
    setChatSearch("");
    setShowChatSearch(false);

    const roomId =
      String(currentUser._id) < String(selectedUser._id)
        ? `${currentUser._id}_${selectedUser._id}`
        : `${selectedUser._id}_${currentUser._id}`;

    socket.emit("join_room", roomId);
    socket.emit("get_messages", {
      userId: currentUser._id,
      otherUserId: selectedUser._id,
    });

    // Mark messages as read when opening chat
    socket.emit("mark_read", {
      senderId: selectedUser._id,
      receiverId: currentUser._id,
    });

    setUsers((prev) =>
      prev.map((u) =>
        String(u._id) === String(selectedUser._id)
          ? { ...u, unread: 0 }
          : u
      )
    );
  }, [selectedUser?._id]);

  // ── scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── auto-focus search ─────────────────────────────────────────────────
  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  // ── close context menu on outside click ───────────────────────────────
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  // ── SEND MESSAGE ──────────────────────────────────────────────────────
  const sendMessage = useCallback(
    (imageData = null, fileData = null) => {
      const text = message.trim();
      if (!text && !imageData && !fileData) return;
      if (!selectedUser) return;

      const roomId =
        String(currentUser._id) < String(selectedUser._id)
          ? `${currentUser._id}_${selectedUser._id}`
          : `${selectedUser._id}_${currentUser._id}`;

      const tempId = `temp_${Date.now()}`;
      const timeStr = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let lastMsg = fileData ? `📎 ${fileData.name}` : imageData ? "📷 Photo" : text;

      const optimistic = {
        _id: tempId,
        text: imageData || fileData ? "" : text,
        image: imageData || undefined,
        file: fileData || undefined,
        senderId: currentUser._id,
        receiverId: selectedUser._id,
        sender: "right",
        time: timeStr,
        delivered: true,
        read: false,
        replyTo: replyTo
          ? {
              _id: replyTo._id,
              text: replyTo.text,
              senderId: replyTo.senderId,
            }
          : undefined,
      };

      setMessages((p) => [...p, optimistic]);
      setUsers((p) =>
        p.map((u) =>
          String(u._id) === String(selectedUser._id)
            ? { ...u, lastMessage: lastMsg, time: timeStr }
            : u
        )
      );

      setMessage("");
      setReplyTo(null);
      setShowEmojiPicker(false);
      clearTimeout(typingTimeout.current);
      socket.emit("typing", { to: selectedUser._id, typing: false });

      socket.emit(
        "send_message",
        {
          roomId,
          senderId: currentUser._id,
          receiverId: selectedUser._id,
          text: imageData || fileData ? "" : text,
          image: imageData,
          file: fileData,
          replyTo: replyTo?._id,
        },
        (savedMsg) => {
          if (!savedMsg) return;
          const realId = savedMsg._id?.toString();
          pendingMsgIds.current.add(realId);
          setMessages((p) =>
            p.map((m) =>
              m._id === tempId
                ? {
                    ...savedMsg,
                    sender: "right",
                    time:
                      savedMsg.time ||
                      new Date(savedMsg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                  }
                : m
            )
          );
        }
      );
    },
    [message, selectedUser, replyTo, currentUser]
  );

  // ── typing emit ───────────────────────────────────────────────────────

const handleInputChange = (e) => {
  setMessage(e.target.value);
  if (!selectedUser) return;
  if (!getSetting("typingIndicator")) return; // <-- yeh add karo
  socket.emit("typing", { to: selectedUser._id, typing: true });
  clearTimeout(typingTimeout.current);
  typingTimeout.current = setTimeout(() => {
    socket.emit("typing", { to: selectedUser._id, typing: false });
  }, 1500);
};

 const handleFileUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    // IMAGE
    if (file.type.startsWith("image/")) {
      setImagePreview({
        url: reader.result,
        name: file.name,
      });
    } else {
      // DOCUMENT / FILE
      setFilePreview({
        url: reader.result,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }
  };

  reader.readAsDataURL(file);
  e.target.value = "";
};
  // ── reaction ──────────────────────────────────────────────────────────
  const addReaction = (msgId, emoji) => {
    setReactions((p) => {
      const prev = p[msgId] || [];
      const exists = prev.includes(emoji);
      return {
        ...p,
        [msgId]: exists ? prev.filter((e) => e !== emoji) : [...prev, emoji],
      };
    });
    setHoverMsg(null);
  };

  const deleteMessage = async (msgId) => {
    setMessages((p) => p.filter((m) => m._id !== msgId));
    setContextMenu(null);
    if (!String(msgId).startsWith("temp_")) {
      try {
        const token = localStorage.getItem("token");
       await fetch(`${API_BASE}/api/auth/messages/${msgId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (_) {}
    }
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setContextMenu(null);
  };

  // ── filter ────────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchStatus =
      filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const displayMessages = chatSearch.trim()
    ? messages.filter((m) =>
        m.text?.toLowerCase().includes(chatSearch.toLowerCase())
      )
    : messages;

  const toggleSearch = () => {
    setShowSearch((p) => !p);
    if (showSearch) setSearchTerm("");
  };
  const closeSearch = () => {
    setShowSearch(false);
    setSearchTerm("");
  };

  const getStatusColor = (s) =>
    ({ online: "#00ff88", offline: "#ff6b6b", typing: "#ffd700" }[s] ||
    "#ff6b6b");

  const handleLogout = () => {
    localStorage.clear();
    setSelectedUser(null);
    setMessages([]);
    setUsers([]);
    socket.removeAllListeners();
    socket.disconnect();
    navigate("/auth");
  };

  const getAvatarDisplay = (user) => {
    if (user?.avatar)
      return (
        <img
         src={`${API_BASE}${user.avatar}`}
          alt={user.name}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "16px",
          }}
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      );
    return (
      <span>
        {user?.initials || user?.name?.charAt(0).toUpperCase()}
      </span>
    );
  };

  const getRepliedMsg = (msg) => {
    if (!msg.replyTo) return null;
    return messages.find(
      (m) => m._id === msg.replyTo?._id || m._id === msg.replyTo
    );
  };

  // ── Tick icon for read receipts ───────────────────────────────────────
  const ReadTick = ({ msg }) => {
    if (msg.sender !== "right") return null;
    const readReceiptsEnabled = getSetting("readReceipts");

    // Grey ticks = delivered, Blue ticks = read
    if (msg.read && readReceiptsEnabled) {
      return (
        <span
          title="Read"
          style={{ marginLeft: "4px", color: theme.accent, fontSize: "11px" }}
        >
          ✓✓
        </span>
      );
    }
    if (msg.delivered) {
      return (
        <span
          title="Delivered"
          style={{
            marginLeft: "4px",
            color: "rgba(255,255,255,0.45)",
            fontSize: "11px",
          }}
        >
          ✓✓
        </span>
      );
    }
    return (
      <span
        title="Sent"
        style={{
          marginLeft: "4px",
          color: "rgba(255,255,255,0.35)",
          fontSize: "11px",
        }}
      >
        ✓
      </span>
    );
  };

  // ── File message bubble ───────────────────────────────────────────────
  const FileBubble = ({ file }) => {
    const isPdf = file?.type === "application/pdf";
    const isImage = file?.type?.startsWith("image/");
    const icon = isPdf ? "📄" : "📎";
    return (
      <a
        href={file.url}
        download={file.name}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "10px 14px",
          marginBottom: "4px",
          border: `1px solid ${theme.accent}30`,
        }}
      >
        <span style={{ fontSize: "26px" }}>{icon}</span>
        <div>
          <div
            style={{
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              maxWidth: "160px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </div>
          <div
            style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px" }}
          >
            {formatFileSize(file.size)} · {isPdf ? "PDF" : "File"}
          </div>
        </div>
        <span style={{ color: theme.accent, fontSize: "18px", marginLeft: "auto" }}>
          ⬇
        </span>
      </a>
    );
  };

  const fontSizeMap = { small: "13px", medium: "15px", large: "17px" };
  const msgFontSize = fontSizeMap[fontSize] || "15px";

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className="alien-dashboard"
      style={{ background: theme.bg }}
    >
      {/* ── LEFT SIDEBAR ────────────────────────────────────────────── */}
      <div
        className="left-sidebar"
        style={{ background: theme.sidebar, borderColor: `${theme.accent}30` }}
      >
        <div
          className={`sidebar-icon ${selectedView === "chat" ? "active" : ""}`}
          onClick={() => setSelectedView("chat")}
          style={{ borderColor: theme.accent }}
        >
          <i className="fa-solid fa-message" style={{ color: theme.accent }} />
        </div>
        <div
          className="sidebar-icon"
          onClick={() => setSelectedView("AddContact")}
          style={{ borderColor: theme.accent }}
        >
          <i className="fa-solid fa-user-plus" style={{ color: theme.accent }} />
        </div>
        <div
          className="sidebar-icon profile"
          onClick={() => setSelectedView("profile")}
          style={{ borderColor: theme.accent }}
        >
          <i className="fa-solid fa-user-astronaut" style={{ color: theme.accent }} />
        </div>
        <div className="sidebar-bottom">
          <div
            className={`sidebar-icon ${selectedView === "settings" ? "active" : ""}`}
            onClick={() => setSelectedView("settings")}
            style={{ borderColor: theme.accent }}
          >
            <i className="fa-solid fa-cog" style={{ color: theme.accent }} />
          </div>
          <div className="logout" onClick={handleLogout}>
            <i className="fa-solid fa-power-off" />
          </div>
        </div>
      </div>

      {/* ── MIDDLE CHATLIST ─────────────────────────────────────────── */}
      {selectedView === "chat" && (
        <div
          className="middle-chatlist"
          style={{
            background: theme.sidebar,
            borderColor: `${theme.accent}25`,
          }}
        >
          <div className="chatlist-header">
            <h3 style={{ color: theme.accent }}>
              <img
                src="/img/Screenshot (171).png"
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "10px",
                  marginRight: "5px",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />{" "}
              ChatterBox
            </h3>
            <div className="header-actions">
              <i
                className={`fa-solid fa-magnifying-glass search-toggle ${
                  showSearch ? "active" : ""
                }`}
                onClick={toggleSearch}
              />
            </div>
          </div>

          {showSearch && (
            <div className="search-container">
              <div className="search-box animated">
                <i className="fa-solid fa-search" />
                <input
                  ref={searchInputRef}
                  className="search-input"
                  placeholder="Search galaxy contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <i
                  className="fa-solid fa-times close-search"
                  onClick={closeSearch}
                />
              </div>
            </div>
          )}

          <div className="chatlist-controls">
            <div className="filter-tabs">
              {["all", "online", "typing"].map((f) => (
                <button
                  key={f}
                  className={filterStatus === f ? "active" : ""}
                  onClick={() => setFilterStatus(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="contacts-list">
            {filteredUsers.length === 0 ? (
              <div className="no-contacts">
                <i className="fa-solid fa-users" />
                <p>No contacts found</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user._id}
                  className={`contact-item ${
                    selectedUser?._id === user._id ? "active" : ""
                  }`}
                  onClick={() => {
                    if (
                      String(selectedUser?._id) !== String(user._id)
                    )
                      setSelectedUser(user);
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div
                      className="contact-avatar"
                      style={{
                        background: user.avatar
                          ? "transparent"
                          : `linear-gradient(135deg, ${getStatusColor(
                              user.status
                            )}, ${getStatusColor(user.status)}ee)`,
                        overflow: "hidden",
                      }}
                    >
                      {getAvatarDisplay(user)}
                    </div>
                    {user.status === "online" && (
                      <span
                        style={{
                          background: "#00ff88",
                          width: "20px",
                          borderRadius: "50%",
                          position: "absolute",
                          bottom: "-4px",
                          right: "-4px",
                          paddingTop: "2px",
                          paddingBottom: "2px",
                          paddingRight: "2px",
                          fontSize: "16px",
                          lineHeight: 1,
                          userSelect: "none",
                        }}
                      >
                        😊
                      </span>
                    )}
                    {user.status === "typing" && (
                      <span
                        style={{
                          position: "absolute",
                          bottom: "-4px",
                          right: "-4px",
                          fontSize: "16px",
                          lineHeight: 1,
                          userSelect: "none",
                        }}
                      >
                        ✍️
                      </span>
                    )}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">{user.name}</div>
                    <div className="contact-lastmsg">
                      {user.lastMessage}
                    </div>
                  </div>
                  <div className="contact-meta">
                    {user.unread > 0 && (
                      <div className="unread-count">
                        {user.unread > 99 ? "99+" : user.unread}
                      </div>
                    )}
                    <div className="contact-time">{user.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div
        className="right-chat"
        style={{ background: theme.chatBg }}
      >
        {selectedView === "chat" ? (
          selectedUser ? (
            <>
              {/* Chat header */}
              <div className="chat-header">
                <div className="chat-user-info">
                  <div
                    className="chat-avatar"
                    style={{
                      overflow: "hidden",
                      padding: selectedUser.avatar ? 0 : undefined,
                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`,
                      boxShadow: `0 10px 30px ${theme.accent}60`,
                    }}
                  >
                    {selectedUser.avatar ? (
                      <img
                       src={`${API_BASE}${selectedUser.avatar}`}
                        alt={selectedUser.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      selectedUser.initials ||
                      selectedUser.name?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4>{selectedUser.name}</h4>
                    {/* Last seen / online status */}
                    <span
                      className={`status ${selectedUser.status}`}
                      style={{
                        color:
                          selectedUser.status === "online"
                            ? theme.accent
                            : selectedUser.status === "typing"
                            ? "#ffd700"
                            : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {selectedUser.status === "online"
                        ? "online"
                        : selectedUser.status === "typing"
                        ? "typing..."
                        : selectedUser.lastSeen
                        ? formatLastSeen(selectedUser.lastSeen)
                        : "offline"}
                    </span>
                  </div>
                </div>

                {/* Chat search icon */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginRight: "10px",
                  }}
                >
                  <i
                    className="fa-solid fa-magnifying-glass"
                    style={{
                      color: showChatSearch
                        ? theme.accent
                        : "rgba(255,255,255,0.5)",
                      cursor: "pointer",
                      fontSize: "16px",
                      transition: "color 0.2s",
                    }}
                    onClick={() => {
                      setShowChatSearch((p) => !p);
                      setChatSearch("");
                    }}
                  />
                </div>
              </div>

              {/* Chat search bar */}
              {showChatSearch && (
                <div
                  style={{
                    padding: "10px 30px",
                    borderBottom: `1px solid ${theme.accent}25`,
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <input
                    autoFocus
                    placeholder="Search messages..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    style={{
                      flex: 1,
                      background: theme.inputBg,
                      border: `1px solid ${theme.accent}50`,
                      borderRadius: "20px",
                      padding: "10px 18px",
                      color: "#fff",
                      fontSize: "14px",
                      outline: "none",
                    }}
                  />
                  <span
                    style={{
                      color: "rgba(255,255,255,0.4)",
                      fontSize: "13px",
                    }}
                  >
                    {chatSearch ? `${displayMessages.length} result(s)` : ""}
                  </span>
                </div>
              )}

              {/* Messages area */}
              <div className="messages-area">
                {displayMessages.length === 0 ? (
                  <div className="no-messages">
                    <p>
                      {chatSearch
                        ? "No messages match your search."
                        : `Say hi 👋 to ${selectedUser.name}`}
                    </p>
                  </div>
                ) : (
                  displayMessages.map((msg) => {
                    const replied = getRepliedMsg(msg);
                    const msgReactions = reactions[msg._id] || [];
                    return (
                      <div
                        key={msg._id}
                        className={`message ${msg.sender}`}
                        style={{ position: "relative" }}
                        onMouseEnter={() => setHoverMsg(msg._id)}
                        onMouseLeave={() => setHoverMsg(null)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            msgId: msg._id,
                            msgText: msg.text,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        {/* Hover action bar */}
                        {hoverMsg === msg._id && (
                          <div
                            style={{
                              position: "absolute",
                              [msg.sender === "right" ? "left" : "right"]:
                                "calc(100% + 6px)",
                              top: "50%",
                              transform: "translateY(-50%)",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "rgba(26,26,34,0.95)",
                              border: `1px solid ${theme.accent}30`,
                              borderRadius: "20px",
                              padding: "4px 8px",
                              zIndex: 10,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {["👍", "❤️", "😂"].map((em) => (
                              <span
                                key={em}
                                onClick={() => addReaction(msg._id, em)}
                                style={{
                                  cursor: "pointer",
                                  fontSize: "16px",
                                  padding: "2px 3px",
                                  borderRadius: "8px",
                                  transition: "transform 0.15s",
                                  transform: msgReactions.includes(em)
                                    ? "scale(1.3)"
                                    : "scale(1)",
                                }}
                              >
                                {em}
                              </span>
                            ))}
                            <span
                              onClick={() => {
                                setReplyTo(msg);
                                inputRef.current?.focus();
                              }}
                              style={{
                                cursor: "pointer",
                                fontSize: "14px",
                                padding: "2px 5px",
                                color: theme.accent,
                              }}
                              title="Reply"
                            >
                              ↩
                            </span>
                          </div>
                        )}

                        <div
                          className="msg-bubble"
                          style={{
                            background:
                              msg.sender === "right"
                                ? theme.msgRight
                                : theme.msgLeft,
                            fontSize: msgFontSize,
                          }}
                        >
                          {/* Reply preview */}
                          {replied && (
                            <div
                              style={{
                                borderLeft: `3px solid ${theme.accent}`,
                                marginBottom: "8px",
                                opacity: 0.7,
                                background: `${theme.accent}10`,
                                borderRadius: "4px",
                                padding: "6px 8px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: theme.accent,
                                  marginBottom: "2px",
                                }}
                              >
                                {String(replied.senderId) ===
                                String(currentUser._id)
                                  ? "You"
                                  : selectedUser.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "rgba(255,255,255,0.7)",
                                }}
                              >
                                {replied.image
                                  ? "📷 Photo"
                                  : replied.file?.name
                                  ? `📎 ${replied.file.name}`
                                  : replied.text?.slice(0, 60)}
                              </div>
                            </div>
                          )}

                          {/* Image message */}
                          {msg.image ? (
                            <img
                              src={msg.image}
                              alt="sent"
                              style={{
                                maxWidth: "240px",
                                borderRadius: "12px",
                                display: "block",
                                marginBottom: "4px",
                              }}
                            />
                          ) : msg.file?.url ? (
                            /* File/Document message */
                            <FileBubble file={msg.file} />
                          ) : (
                            <p>{msg.text}</p>
                          )}

                          <span className="msg-time">
                            {msg.time}
                            {/* Read receipt ticks */}
                            <ReadTick msg={msg} />
                          </span>
                        </div>

                        {/* Reactions display */}
                        {msgReactions.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              gap: "2px",
                              flexWrap: "wrap",
                              marginTop: "4px",
                              justifyContent:
                                msg.sender === "right"
                                  ? "flex-end"
                                  : "flex-start",
                            }}
                          >
                            {msgReactions.map((em, i) => (
                              <span
                                key={i}
                                onClick={() => addReaction(msg._id, em)}
                                style={{
                                  fontSize: "14px",
                                  background: `${theme.accent}20`,
                                  borderRadius: "10px",
                                  padding: "2px 6px",
                                  cursor: "pointer",
                                  border: `1px solid ${theme.accent}30`,
                                }}
                              >
                                {em}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply preview bar */}
              {replyTo && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 30px",
                    background: `${theme.accent}10`,
                    borderTop: `1px solid ${theme.accent}25`,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      borderLeft: `3px solid ${theme.accent}`,
                      paddingLeft: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        color: theme.accent,
                        marginBottom: "2px",
                      }}
                    >
                      {String(replyTo.senderId) === String(currentUser._id)
                        ? "You"
                        : selectedUser.name}
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      {replyTo.image
                        ? "📷 Photo"
                        : replyTo.file?.name
                        ? `📎 ${replyTo.file.name}`
                        : replyTo.text?.slice(0, 80)}
                    </div>
                  </div>
                  <span
                    style={{
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: "18px",
                    }}
                    onClick={() => setReplyTo(null)}
                  >
                    ✕
                  </span>
                </div>
              )}

              {/* Image preview modal */}
              {imagePreview && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    zIndex: 999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "16px",
                  }}
                >
                  <img
                    src={imagePreview.url}
                    alt="preview"
                    style={{
                      maxWidth: "80%",
                      maxHeight: "70vh",
                      borderRadius: "16px",
                    }}
                  />
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      onClick={() => {
                        sendMessage(imagePreview.url);
                        setImagePreview(null);
                      }}
                      style={{
                        background: `linear-gradient(135deg,${theme.accent},${theme.accentAlt})`,
                        border: "none",
                        color: "#111",
                        padding: "12px 28px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "15px",
                      }}
                    >
                      Send 📤
                    </button>
                    <button
                      onClick={() => setImagePreview(null)}
                      style={{
                        background: "rgba(255,71,87,0.2)",
                        border: "1px solid #ff4757",
                        color: "#ff4757",
                        padding: "12px 28px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: "15px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* File/Document preview modal (NEW) */}
              {filePreview && (
                <div
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.85)",
                    zIndex: 999,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "20px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(20,20,30,0.98)",
                      border: `1px solid ${theme.accent}40`,
                      borderRadius: "20px",
                      padding: "32px 40px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "14px",
                      minWidth: "280px",
                    }}
                  >
                    <div style={{ fontSize: "52px" }}>
                      {filePreview.type === "application/pdf" ? "📄" : "📎"}
                    </div>
                    <div
                      style={{
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "16px",
                        textAlign: "center",
                        maxWidth: "240px",
                        wordBreak: "break-word",
                      }}
                    >
                      {filePreview.name}
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: "13px",
                      }}
                    >
                      {formatFileSize(filePreview.size)}
                    </div>
                    <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                      <button
                        onClick={() => {
                          sendMessage(null, {
                            url: filePreview.url,
                            name: filePreview.name,
                            size: filePreview.size,
                            type: filePreview.type,
                          });
                          setFilePreview(null);
                        }}
                        style={{
                          background: `linear-gradient(135deg,${theme.accent},${theme.accentAlt})`,
                          border: "none",
                          color: "#111",
                          padding: "12px 28px",
                          borderRadius: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "15px",
                        }}
                      >
                        Send 📤
                      </button>
                      <button
                        onClick={() => setFilePreview(null)}
                        style={{
                          background: "rgba(255,71,87,0.2)",
                          border: "1px solid #ff4757",
                          color: "#ff4757",
                          padding: "12px 28px",
                          borderRadius: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontSize: "15px",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat input */}
              <div
                className="chat-input"
                style={{
                  flexDirection: "column",
                  gap: "0",
                  padding: "20px 40px 30px",
                  borderColor: `${theme.accent}30`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                  }}
                >
                 

                
                  <button
                    onClick={() => docInputRef.current.click()}
                    title="Send File/Document"
                    style={{
                      background: `${theme.accent}25`,
                      border: `1px solid ${theme.accent}50`,
                      borderRadius: "14px",
                      width: "46px",
                      height: "46px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: theme.accent,
                      fontSize: "16px",
                      flexShrink: 0,
                    }}
                  >
                    📎
                  </button>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="image,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.ppt,.pptx,.csv"
                    hidden
               onChange={handleFileUpload}
                  />

                  {/* Emoji picker toggle */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => setShowEmojiPicker((p) => !p)}
                      style={{
                        background: `${theme.accent}25`,
                        border: `1px solid ${theme.accent}50`,
                        borderRadius: "14px",
                        width: "46px",
                        height: "46px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        fontSize: "20px",
                        flexShrink: 0,
                      }}
                    >
                      😊
                    </button>
                    {showEmojiPicker && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "55px",
                          left: 0,
                          background: "rgba(17,17,17,0.98)",
                          border: `1px solid ${theme.accent}30`,
                          borderRadius: "16px",
                          padding: "12px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "6px",
                          width: "220px",
                          zIndex: 50,
                          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                        }}
                      >
                        {EMOJI_LIST.map((em) => (
                          <span
                            key={em}
                            onClick={() => {
                              setMessage((p) => p + em);
                              setShowEmojiPicker(false);
                              inputRef.current?.focus();
                            }}
                            style={{
                              fontSize: "22px",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "8px",
                              transition: "transform 0.15s",
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.transform = "scale(1.3)";
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.transform = "scale(1)";
                            }}
                          >
                            {em}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <input
                    ref={inputRef}
                    className="message-input"
                    placeholder="Type a message..."
                    value={message}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      const enterToSend = getSetting("enterToSend");
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        enterToSend
                      ) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      background: theme.inputBg,
                      borderColor: `${theme.accent}35`,
                    }}
                  />
                  <button
                    className={`send-btn ${message ? "active" : ""}`}
                    onClick={() => sendMessage()}
                    disabled={!message.trim()}
                    style={
                      message
                        ? {
                            background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentAlt})`,
                            boxShadow: `0 10px 35px ${theme.accent}80`,
                          }
                        : {}
                    }
                  >
                    <i className="fa-solid fa-paper-plane" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="no-chat-selected">
              <img
                src="./img/Screenshot (171).png"
                style={{
                  marginBottom: "10px",
                  borderRadius: "30px",
                  width: "80px",
                }}
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
              <h3>Select a Contact</h3>
              <p>Choose from your galactic contacts to start chatting</p>
            </div>
          )
        ) : selectedView === "profile" ? (
          <Profile />
        ) : selectedView === "AddContact" ? (
          <AddContact setUsers={setUsers} users={users} />
        ) : selectedView === "settings" ? (
          <Settings onLogout={handleLogout} />
        ) : null}
      </div>

      {/* ── CONTEXT MENU ────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "rgba(17,17,17,0.98)",
            border: `1px solid ${theme.accent}30`,
            borderRadius: "12px",
            padding: "6px 0",
            zIndex: 9999,
            minWidth: "150px",
            boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            {
              label: "📋 Copy",
              action: () => copyMessage(contextMenu.msgText),
            },
            {
              label: "↩ Reply",
              action: () => {
                const m = messages.find(
                  (x) => x._id === contextMenu.msgId
                );
                if (m) setReplyTo(m);
                setContextMenu(null);
              },
            },
            {
              label: "🗑️ Delete",
              action: () => deleteMessage(contextMenu.msgId),
              danger: true,
            },
          ].map((item) => (
            <div
              key={item.label}
              onClick={item.action}
              style={{
                padding: "10px 18px",
                cursor: "pointer",
                fontSize: "14px",
                color: item.danger ? "#ff4757" : "#fff",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = `${theme.accent}18`;
              }}
              onMouseLeave={(e) => {
                e.target.style.background = "transparent";
              }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}

      {/* All original CSS kept intact */}
      <style jsx>{`

      
        .alien-dashboard {
          display: flex; height: 100vh;
          font-family: 'Orbitron', -apple-system, BlinkMacSystemFont, sans-serif;
          overflow: hidden; position: relative;
        }
        .alien-dashboard::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 20% 20%, rgba(133,194,255,0.15) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(0,255,136,0.1) 0%, transparent 50%);
          pointer-events: none; z-index: 1;
        }
        .left-sidebar {
          width: 72px; display: flex; flex-direction: column; padding: 30px 0;
          align-items: center; gap: 25px; flex-shrink: 0;
          border-right: 1px solid rgba(133,194,255,0.2);
          backdrop-filter: blur(25px); z-index: 10;
        }
        .sidebar-icon {
          width: 50px; height: 50px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          border: 2px solid #85C2FF; position: relative; overflow: hidden;
        }
        .sidebar-icon:hover {
          background: linear-gradient(135deg, rgba(133,194,255,0.2), rgba(77,166,255,0.15));
          transform: scale(1.1); box-shadow: 0 8px 25px rgba(133,194,255,0.3);
        }
        .sidebar-icon.active { box-shadow: 0 0 20px rgba(133,194,255,0.5); }
        .sidebar-icon i { font-size: 20px; transition: color 0.3s ease; }
        .logout {
          color: red; width: 50px; height: 50px;
          background: rgba(17,17,17,0.98); border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          border: 2px solid #272626ff;
        }
        .sidebar-bottom { display: flex; flex-direction: column; gap: 30px; margin-top: auto; }
        .middle-chatlist {
          flex: 1; max-width: 400px;
          border-right: 1px solid rgba(133,194,255,0.15);
          display: flex; flex-direction: column; z-index: 5; backdrop-filter: blur(20px);
        }
        .chatlist-header {
          padding: 25px 25px 20px; border-bottom: 1px solid rgba(133,194,255,0.15);
          display: flex; justify-content: space-between; align-items: center;
        }
        .chatlist-header h3 { margin: 0; font-size: 22px; font-weight: 700; }
        .header-actions { display: flex; align-items: center; gap: 15px; }
        .header-actions i {
          color: rgba(255,255,255,0.6); font-size: 18px; cursor: pointer;
          padding: 10px; border-radius: 10px; transition: all 0.3s ease;
        }
        .header-actions i:hover { color: #85C2FF; background: rgba(133,194,255,0.15); transform: scale(1.1); }
        .search-toggle { font-size: 20px !important; padding: 12px !important; border-radius: 12px !important; }
        .search-container {
          padding: 0 25px 20px;
          animation: slideDown 0.4s cubic-bezier(0.4,0,0.2,1);
          border-bottom: 1px solid rgba(133,194,255,0.1);
        }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        .search-box.animated {
          position: relative; background: rgba(26,26,34,0.95); border-radius: 25px;
          box-shadow: 0 8px 25px rgba(0,0,0,0.3); overflow: hidden;
          border: 2px solid rgba(133,194,255,0.3);
        }
        .search-input {
          width: 100%; padding: 16px 60px 16px 20px; border: none;
          background: transparent; color: #fff; font-size: 15px; outline: none;
        }
        .search-input::placeholder { color: rgba(255,255,255,0.5); }
        .search-box i.fa-search { position: absolute; right: 50px; top: 50%; transform: translateY(-50%); color: rgba(133,194,255,0.6); font-size: 16px; z-index: 2; }
        .close-search { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.6); font-size: 16px; cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.3s ease; z-index: 2; }
        .close-search:hover { color: #ff4757; background: rgba(255,71,87,0.2); }
        .chatlist-controls { padding: 15px 25px 20px; }
        .filter-tabs { display: flex; gap: 12px; }
        .filter-tabs button {
          flex: 1; padding: 12px 8px; border: 2px solid rgba(133,194,255,0.2);
          background: rgba(26,26,34,0.7); color: rgba(255,255,255,0.8);
          border-radius: 20px; cursor: pointer; transition: all 0.3s ease; font-size: 14px;
        }
        .filter-tabs button.active, .filter-tabs button:hover {
          background: linear-gradient(135deg, #85C2FF, #4da6ff); color: #111;
          border-color: #85C2FF; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(133,194,255,0.3);
        }
        .contacts-list { flex: 1; overflow-y: auto; padding: 20px; }
        .no-contacts { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 200px; color: rgba(255,255,255,0.4); text-align: center; }
        .no-contacts i { font-size: 48px; margin-bottom: 15px; opacity: 0.6; }
        .contact-item {
          display: flex; align-items: center; gap: 18px; padding: 20px;
          border-radius: 20px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
          margin-bottom: 12px; border: 1px solid transparent;
        }
        .contact-item:hover { background: rgba(133,194,255,0.08); border-color: rgba(133,194,255,0.15); transform: translateX(8px); }
        .contact-item.active { background: linear-gradient(135deg, rgba(133,194,255,0.15), rgba(77,166,255,0.1)); border-color: rgba(133,194,255,0.3); box-shadow: 0 10px 30px rgba(133,194,255,0.2); }
        .contact-avatar {
          width: 56px; height: 56px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; position: relative; box-shadow: 0 6px 20px rgba(0,0,0,0.3); flex-shrink: 0;
        }
        .contact-info { flex: 1; min-width: 0; }
        .contact-name { font-weight: 600; color: #fff; font-size: 16px; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-lastmsg { color: rgba(255,255,255,0.75); font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .contact-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .unread-count {
          background: linear-gradient(135deg, #ff4757, #ff6b7a); color: white;
          border-radius: 14px; padding: 6px 10px; font-size: 12px; font-weight: 700;
          min-width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 12px rgba(255,71,87,0.4);
        }
        .contact-time { font-size: 12px; color: rgba(255,255,255,0.5); font-weight: 500; }
        .right-chat { flex: 1; display: flex; flex-direction: column; position: relative; backdrop-filter: blur(25px); }
        .chat-header { padding: 30px 35px; border-bottom: 1px solid rgba(133,194,255,0.15); display: flex; justify-content: space-between; align-items: center; }
        .chat-user-info { display: flex; align-items: center; gap: 20px; }
        .chat-avatar { width: 60px; height: 60px; border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 28px; flex-shrink: 0; }
        .chat-user-info h4 { margin: 0; color: #fff; font-size: 24px; font-weight: 700; }
        .status { font-size: 13px; font-weight: 500; display: block; margin-top: 4px; }
        .no-chat-selected, .no-messages { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; color: rgba(255,255,255,0.5); padding: 60px 40px; }
        .messages-area { flex: 1; overflow-y: auto; padding: 40px; display: flex; flex-direction: column; gap: 18px; scrollbar-width: none; }
        .messages-area::-webkit-scrollbar { display: none; }
        .message { max-width: 60%; width: fit-content; display: flex; flex-direction: column; animation: msgSlide 0.4s cubic-bezier(0.4,0,0.2,1); }
        .message.left { align-self: flex-start; }
        .message.right { align-self: flex-end; }
        .msg-bubble { max-width: 100%; padding: 14px 18px 28px 18px; border-radius: 18px; line-height: 1.5; position: relative; box-shadow: 0 12px 40px rgba(0,0,0,0.4); white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; border: 1px solid rgba(133,194,255,0.25); }
        .msg-bubble p { margin: 0; padding-right: 55px; }
        .message.left .msg-bubble { border-top-left-radius: 6px; }
        .message.right .msg-bubble { border-top-right-radius: 6px; }
        .msg-time { position: absolute; bottom: 6px; right: 12px; font-size: 11px; opacity: 0.7; display: flex; align-items: center; gap: 2px; }
        .chat-input { background: rgba(0,0,0,0.85); border-top: 1px solid rgba(133,194,255,0.2); display: flex; align-items: center; gap: 18px; backdrop-filter: blur(30px); }
        .message-input { flex: 1; padding: 20px 30px; border-radius: 30px; border: 2px solid rgba(133,194,255,0.2); color: #fff; font-size: 16px; outline: none; transition: all 0.3s ease; }
        .message-input:focus { border-color: #85C2FF; box-shadow: 0 0 30px rgba(133,194,255,0.4); }
        .message-input::placeholder { color: rgba(255,255,255,0.5); }
        .send-btn { background: rgba(133,194,255,0.25); border: none; border-radius: 18px; width: 58px; height: 58px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.4s cubic-bezier(0.4,0,0.2,1); font-size: 18px; color: #fff; }
        .send-btn:hover:not(:disabled) { transform: scale(1.1); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes msgSlide { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .contacts-list::-webkit-scrollbar { width: 6px; }
        .contacts-list::-webkit-scrollbar-track { background: rgba(26,26,34,0.5); border-radius: 10px; }
        .contacts-list::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #85C2FF, #4da6ff); border-radius: 10px; }
        @media (max-width: 768px) {
          .alien-dashboard { flex-direction: column; }
          .left-sidebar { flex-direction: row; width: 100%; height: 72px; padding: 0 30px; }
          .middle-chatlist { max-width: none; order: 3; }
        }

        /* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .alien-dashboard { position: relative; }
  .left-sidebar {
    flex-direction: row; width: 100%; height: 60px;
    padding: 0 16px; gap: 12px; order: 3;
    border-right: none; border-top: 1px solid rgba(133,194,255,0.2);
    position: fixed; bottom: 0; left: 0; z-index: 100;
  }
  .sidebar-bottom { flex-direction: row; margin-top: 0; gap: 12px; }
  .sidebar-icon { width: 42px; height: 42px; }
  .middle-chatlist {
    max-width: 100%; width: 100%;
    position: fixed; top: 0; left: 0; right: 0; bottom: 60px;
    z-index: 50; overflow: hidden; display: flex; flex-direction: column;
  }
  .right-chat {
    position: fixed; top: 0; left: 0; right: 0; bottom: 60px;
    z-index: 50;
  }
  .messages-area { padding: 16px; }
  .chat-header { padding: 16px 18px; }
  .chat-input { padding: 12px 16px 16px !important; }
  .message { max-width: 85%; }
  .contacts-list { padding: 10px; }
  .chatlist-header { padding: 16px 18px 12px; }
  .chatlist-controls { padding: 8px 14px 10px; }
}

@media (max-width: 480px) {
  .chatlist-header h3 { font-size: 17px; }
  .contact-name { font-size: 14px; }
  .contact-lastmsg { font-size: 12px; }
  .filter-tabs button { font-size: 12px; padding: 8px 4px; }
  .message { max-width: 92%; }
  .msg-bubble { padding: 10px 12px 24px 12px; }
  .chat-user-info h4 { font-size: 17px; }
  .message-input { padding: 14px 16px; font-size: 14px; }
  .send-btn { width: 48px; height: 48px; font-size: 16px; }
}

      `}</style>
    </div>
  );
}