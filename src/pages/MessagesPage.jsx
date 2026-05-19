import { useState, useEffect, useRef, useCallback } from "react";
import { api, WS_BASE, BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { AvatarImg } from "../components/AvatarImg";
import { timeAgo } from "../dateUtils";

const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  )
    return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanUrl}`;
};

function ChatWindow({ match, onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const scrolledToBottom = useRef(false);

  const scrollToBottom = (smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  useEffect(() => {
    scrolledToBottom.current = false;
    // Gửi token qua query param vì WebSocket không hỗ trợ Authorization Header trong trình duyệt
    const token = localStorage.getItem("token");
    const wsUrl = `${WS_BASE}/chat/ws/${match.id}${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsReady(true);

    ws.onmessage = (e) => {
      let data;
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      if (data.type === "history") {
        setMessages(data.messages || []);
        setHasMore(data.has_more || false);
        setNextCursor(data.next_cursor || null);
        // scroll xuống sau khi render
        setTimeout(() => {
          scrollToBottom(false);
          scrolledToBottom.current = true;
        }, 80);
      } else if (data.type === "message") {
        setMessages((m) => [...m, data.message]);
        setTimeout(() => scrollToBottom(true), 50);
      } else if (data.type === "system") {
        setPartnerOnline(!!data.user_online);
      } else if (data.type === "error") {
        toast(data.content, "error");
      }
    };

    ws.onclose = (e) => {
      setWsReady(false);
      const msgs = {
        4001: "Chưa đăng nhập",
        4003: "Không có quyền vào phòng",
        4004: "Phòng đã đủ 2 người",
      };
      if (msgs[e.code]) toast(msgs[e.code], "error");
    };

    ws.onerror = () => ws.close();

    inputRef.current?.focus();
    return () => {
      ws.close();
    };
  }, [match.id]);

  // Load thêm tin nhắn cũ hơn qua REST (cursor-based)
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // GET /chat/:match_id/history?limit=50&before_id=CURSOR
      const data = await api.get(
        // Thêm /api/ và dấu /
        `/api/chat/${match.id}/history/?limit=50&before_id=${nextCursor}`,
      );
      setMessages((m) => [...(data.messages || []), ...m]);
      setHasMore(data.has_more || false);
      setNextCursor(data.next_cursor || null);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const sendMsg = (e) => {
    e.preventDefault();
    if (
      !text.trim() ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    )
      return;
    if (text.length > 500) {
      toast("Tin nhắn quá dài (tối đa 500 ký tự)", "error");
      return;
    }
    wsRef.current.send(JSON.stringify({ content: text.trim() }));
    setText("");
  };

  // Nhóm tin nhắn liên tiếp cùng sender
  const grouped = messages.reduce((acc, msg) => {
    if (!acc.length || acc[acc.length - 1].senderId !== msg.sender_id) {
      acc.push({
        senderId: msg.sender_id,
        username: msg.sender_username,
        msgs: [msg],
      });
    } else {
      acc[acc.length - 1].msgs.push(msg);
    }
    return acc;
  }, []);

  const isMe = (id) => id === user?.id;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 20px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm"
          style={{ padding: "6px 10px" }}
        >
          ← Quay lại
        </button>
        <div style={{ position: "relative" }}>
          <AvatarImg
            src={resolveMediaUrl(match.avatar_url)}
            name={match.name}
            size={38}
          />
          {partnerOnline && (
            <div
              className="online-dot"
              style={{ position: "absolute", bottom: 0, right: 0 }}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{match.name}</div>
          <div
            style={{
              fontSize: 12,
              color: partnerOnline ? "#22c55e" : "var(--ink-ghost)",
            }}
          >
            {wsReady
              ? partnerOnline
                ? "● Đang online"
                : "○ Offline"
              : "Đang kết nối..."}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {hasMore && (
          <div style={{ textAlign: "center", paddingBottom: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <span className="spinner" style={{ width: 14, height: 14 }} />
              ) : (
                "↑ Tải tin nhắn cũ hơn"
              )}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💌</div>
            <p>Hãy gửi lời chào đầu tiên!</p>
          </div>
        )}

        {grouped.map((group, gi) => {
          const me = isMe(group.senderId);
          return (
            <div
              key={gi}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: me ? "flex-end" : "flex-start",
                gap: 3,
              }}
            >
              {!me && (
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-ghost)",
                    marginLeft: 8,
                  }}
                >
                  {group.username}
                </span>
              )}
              {group.msgs.map((msg, i) => (
                <div
                  key={msg.id}
                  title={timeAgo(msg.created_at)}
                  style={{
                    maxWidth: "68%",
                    background: me
                      ? "linear-gradient(135deg, var(--rose), var(--rose-light))"
                      : "var(--surface)",
                    color: me ? "white" : "var(--ink)",
                    padding: "9px 14px",
                    borderRadius: me
                      ? `16px 16px ${i === group.msgs.length - 1 ? "4px" : "16px"} 16px`
                      : `16px 16px 16px ${i === group.msgs.length - 1 ? "4px" : "16px"}`,
                    fontSize: 14,
                    lineHeight: 1.5,
                    boxShadow: me
                      ? "0 3px 10px rgba(232,54,74,0.2)"
                      : "var(--shadow-sm)",
                    border: me ? "none" : "1px solid var(--border)",
                    animation: "fadeUp 0.15s ease",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                  {i === group.msgs.length - 1 && (
                    <div
                      style={{
                        fontSize: 10,
                        opacity: 0.65,
                        marginTop: 3,
                        textAlign: me ? "right" : "left",
                      }}
                    >
                      {timeAgo(msg.created_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMsg}
        style={{
          padding: "12px 16px",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          className="input-field"
          placeholder="Nhắn tin... (tối đa 500 ký tự)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
          style={{ flex: 1 }}
          disabled={!wsReady}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={!text.trim() || !wsReady}
          style={{
            width: 44,
            height: 44,
            padding: 0,
            borderRadius: "50%",
            fontSize: 18,
          }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}

export function MessagesPage({ chatMatch, setChatMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // GET /api/match/me → danh sách matches đã accept
    api // Thêm dấu /
      .get("/api/match/me/")
      .then((d) => setMatches(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (chatMatch) {
    return <ChatWindow match={chatMatch} onBack={() => setChatMatch(null)} />;
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, color: "var(--rose)", marginBottom: 4 }}>
          Tin nhắn
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Chat với những người đã kết đôi
        </p>
      </div>

      {loading ? (
        <div className="page-loader">
          <span className="spinner" />
        </div>
      ) : matches.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 64, marginBottom: 16 }}>💬</div>
          <h3>Chưa có cuộc trò chuyện nào</h3>
          <p>Kết đôi với ai đó để bắt đầu chat!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {matches.map((m) => (
            <button
              key={m.id}
              onClick={() =>
                setChatMatch({
                  id: m.id,
                  name: m.user2_username,
                  avatar_url: m.user2_avatar_url,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                cursor: "pointer",
                transition: "all 0.2s",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--rose)";
                e.currentTarget.style.background = "var(--rose-pale)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface)";
              }}
            >
              <div style={{ position: "relative" }}>
                <AvatarImg
                  src={resolveMediaUrl(m.user2_avatar_url)} // Sử dụng resolveMediaUrl
                  name={m.user2_username}
                  size={50}
                />
                {m.partner_is_online && (
                  <div
                    className="online-dot"
                    style={{ position: "absolute", bottom: 1, right: 1 }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                  {m.user2_username}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--ink-soft)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.user2_bio || "Nhấn để bắt đầu chat..."}
                </div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}
              >
                {m.partner_is_online ? (
                  <span
                    style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}
                  >
                    ● Online
                  </span>
                ) : (
                  <span style={{ fontSize: 18 }}>💬</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
