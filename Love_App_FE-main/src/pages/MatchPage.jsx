import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useToast } from "../ToastContext";
import { AvatarImg } from "../components/AvatarImg";
import { getEmotionRandomMatch } from "../services/emotionMatchApi";

const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanUrl}`;
};

// Re-using SentimentBadge from ProfilePage for consistency
// (Đảm bảo SentimentBadge được định nghĩa hoặc import nếu cần)
function SentimentBadge({ score }) {
  if (!score) return null;
  const map = {
    positive: ["#fef3c7", "#d97706", "✨ Tích cực"],
    negative: ["#fce7f3", "#db2777", "💔 Tiêu cực"],
    neutral: ["#f1f5f9", "#64748b", "😐 Trung lập"],
  };
  const [bg, color, label] = map[score] || map.neutral;
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 100,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {label}
    </span>
  );
}

function MatchCard({ match, onAccept, onSkip, loading, openUserProfile }) {
  const partner = {
    id: match.user2_id,
    username: match.user2_username,
    bio: match.user2_bio,
    avatar_url: match.user2_avatar_url,
    sentiment: match.user2_sentiment,
    is_online: match.partner_is_online,
  };

  return (
    <div
      style={{
        background: "var(--surface)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-lg)",
        border: "1px solid var(--border)",
        maxWidth: 400,
        width: "100%",
        animation: "fadeUp 0.4s ease",
      }}
    >
      {/* Card top visual */}
      <div
        style={{
          background:
            "linear-gradient(160deg, var(--rose-pale) 0%, var(--blush) 100%)",
          padding: "40px 24px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          position: "relative",
        }}
      >
        {/* Decorative hearts */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 20,
            fontSize: 20,
            opacity: 0.3,
            animation: "float 3s ease-in-out infinite",
          }}
        >
          💕
        </div>
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 16,
            fontSize: 14,
            opacity: 0.2,
            animation: "float 4s ease-in-out infinite 1s",
          }}
        >
          ✨
        </div>

        <div style={{ position: "relative" }}>
          <AvatarImg
            src={resolveMediaUrl(partner.avatar_url)}
            name={partner.username}
            size={100}
            style={{
              border: "3px solid white",
              boxShadow: "0 8px 24px rgba(232,54,74,0.2)",
            }}
          />
          {partner.is_online && (
            <div
              className="online-dot"
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                width: 14,
                height: 14,
              }}
            />
          )}
        </div>

        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 26, marginBottom: 8 }}>{partner.username}</h2>
          <SentimentBadge score={partner.sentiment} />
          {partner.is_online && (
            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#22c55e",
                fontWeight: 600,
              }}
            >
              ● Đang online
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      <div style={{ padding: "20px 24px" }}>
        {partner.bio ? (
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-mid)",
              lineHeight: 1.7,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            "{partner.bio}"
          </p>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: "var(--ink-ghost)",
              textAlign: "center",
            }}
          >
            Chưa có giới thiệu...
          </p>
        )}
      </div>

      {/* Match info */}
      <div style={{ padding: "0 24px", marginBottom: 20 }}>
        <div
          style={{
            background: "var(--cream)",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "var(--ink-soft)",
          }}
        >
          <span>🤖</span>
          <span>
            AI đã ghép đôi bạn với người này dựa trên{" "}
            <strong>phân tích cảm xúc</strong> của bài viết
          </span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "0 24px 24px", display: "flex", gap: 12 }}>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={() => onSkip(match.id)}
          disabled={loading}
        >
          ❌ Bỏ qua
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 2 }}
          onClick={() => onAccept(match.id)}
          disabled={loading}
        >
          {loading ? (
            <span className="spinner" style={{ width: 16, height: 16 }} />
          ) : (
            "💘 Thích"
          )}
        </button>
      </div>
    </div>
  );
}

function MyMatchCard({ match, onUnmatch, onChat }) {
  const isUser1 = !!match.user1_username;
  const partner = {
    username: match.user2_username,
    avatar_url: match.user2_avatar_url,
    bio: match.user2_bio,
    sentiment: match.user2_sentiment,
    is_online: match.partner_is_online,
  };

  return (
    <div
      className="card"
      style={{
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ position: "relative" }}>
        <AvatarImg
          src={resolveMediaUrl(partner.avatar_url)}
          name={partner.username}
          size={52}
        />
        {partner.is_online && (
          <div
            className="online-dot"
            style={{ position: "absolute", bottom: 1, right: 1 }}
          />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{partner.username}</div>
        {partner.bio && (
          <div
            style={{
              fontSize: 13,
              color: "var(--ink-soft)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {partner.bio}
          </div>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#22c55e",
            display: "inline-block",
            marginTop: 2,
          }}
        >
          💘 Đã kết đôi
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => onChat(match.id, partner.username)}
        >
          💬 Chat
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => onUnmatch(match.id)}
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

export function MatchPage({ setPage, setChatMatch }) {
  const toast = useToast();
  const [suggestion, setSuggestion] = useState(null);
  const [myMatches, setMyMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(true);
  const [tab, setTab] = useState("discover"); // discover | matches
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSuggestion = useCallback(async (random = false) => {
    setSuggesting(true);
    setSuggestion(null);
    try {
      // Nếu là random, sử dụng API emotion-random mới, ngược lại dùng suggest cũ
      const data = random
        ? await getEmotionRandomMatch()
        : await api.get("/api/match/suggest/");
      setSuggestion(data);
    } catch {
      setSuggestion(null);
    } finally {
      setSuggesting(false);
    }
  }, []);

  const fetchMatches = useCallback(async () => {
    setLoading(true); // Thêm dấu /
    try {
      const data = await api.get("/api/match/me");
      setMyMatches(Array.isArray(data) ? data : []);
    } catch {
      setMyMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestion();
    fetchMatches();
  }, [fetchSuggestion, fetchMatches]);

  const handleAccept = async (matchId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/match/${matchId}/accept/`); // Thêm dấu /
      toast("💘 Đã gửi lời thích! Chờ người đó phản hồi nhé~", "success");
      await fetchMatches();
      fetchSuggestion();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (matchId) => {
    setActionLoading(true);
    try {
      await api.post(`/api/match/${matchId}/skip/`); // Thêm dấu /
      fetchSuggestion();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnmatch = async (matchId) => {
    if (!confirm("Hủy kết đôi với người này?")) return;
    try {
      // Thêm dấu /
      await api.post(`/api/match/${matchId}/unmatch/`);
      setMyMatches((m) => m.filter((x) => x.id !== matchId));
      toast("Đã hủy kết đôi", "info");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  const handleChat = (matchId, partnerName) => {
    setChatMatch({ id: matchId, name: partnerName });
    setPage("messages");
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, color: "var(--rose)", marginBottom: 4 }}>
          Khám phá
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          AI ghép đôi thông minh theo cảm xúc
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          background: "var(--rose-pale)",
          borderRadius: 100,
          padding: 4,
          marginBottom: 28,
        }}
      >
        {[
          ["discover", "💘 Khám phá"],
          ["matches", `💑 Kết đôi (${myMatches.length})`],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              flex: 1,
              padding: "8px 16px",
              borderRadius: 100,
              border: "none",
              background: tab === k ? "var(--rose)" : "transparent",
              color: tab === k ? "white" : "var(--ink-soft)",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "discover" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
          }}
        >
          {suggesting ? (
            <div
              className="page-loader"
              style={{ flexDirection: "column", gap: 16 }}
            >
              <span className="spinner" style={{ width: 40, height: 40 }} />
              <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                AI đang tìm người phù hợp...
              </p>
            </div>
          ) : suggestion ? (
            <>
              <MatchCard
                match={suggestion}
                onAccept={handleAccept}
                onSkip={handleSkip}
                loading={actionLoading}
              />
              <button
                className="btn btn-ghost"
                onClick={() => fetchSuggestion(true)}
                style={{ fontSize: 13 }}
              >
                🎲 Gợi ý ngẫu nhiên
              </button>
            </>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 64, marginBottom: 16 }}>🌸</div>
              <h3>Không tìm thấy gợi ý</h3>
              <p style={{ marginBottom: 24 }}>
                Hãy đăng thêm bài viết để AI hiểu bạn hơn nhé!
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => fetchSuggestion()}
                >
                  🤖 AI gợi ý
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => fetchSuggestion(true)}
                >
                  🎲 Ngẫu nhiên
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "matches" && (
        <div>
          {loading ? (
            <div className="page-loader">
              <span className="spinner" />
            </div>
          ) : myMatches.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 64, marginBottom: 16 }}>💌</div>
              <h3>Chưa có kết đôi nào</h3>
              <p>Hãy thích người khác để bắt đầu kết đôi!</p>
              <button
                className="btn btn-primary"
                style={{ marginTop: 20 }}
                onClick={() => setTab("discover")}
              >
                💘 Khám phá ngay
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myMatches.map((m) => (
                <MyMatchCard
                  key={m.id}
                  match={m}
                  onUnmatch={handleUnmatch}
                  onChat={handleChat}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
