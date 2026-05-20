// src/pages/MatchPage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { AvatarImg } from "../components/AvatarImg";

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

// Re-using SentimentBadge from ProfilePage for consistency
function SentimentBadge({ score }) {
  if (!score) return null;
  const map = {
    positive: ["#fef3c7", "#d97706", "✨ Tích cực"],
    negative: ["#fce7f3", "#db2777", "💔 Buồn"],
    neutral: ["#f1f5f9", "#64748b", "😐 Trung lập"],
  };
  const [bg, color, label] = map[score] || map.neutral;
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 100,
        padding: "4px 12px",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}

export function MatchPage({ openUserProfile }) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [noMoreMatches, setNoMoreMatches] = useState(false);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/match/suggest?limit=10");
      if (Array.isArray(data) && data.length > 0) {
        setSuggestedMatches(data);
        setNoMoreMatches(false);
      } else {
        setSuggestedMatches([]);
        setNoMoreMatches(true);
      }
    } catch (err) {
      toast(err.message, "error");
      setSuggestedMatches([]);
      setNoMoreMatches(true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleAction = useCallback(
    async (actionType, matchId) => {
      if (actionLoading) return;

      setActionLoading(true);
      try {
        await api.post(`/api/match/${actionType}`, {
          target_user_id: matchId,
        });
        toast(
          actionType === "like"
            ? `Bạn đã thích người này!`
            : `Bạn đã bỏ qua người này.`,
          "success",
        );

        // Remove the acted-upon match from the list
        setSuggestedMatches((prevMatches) =>
          prevMatches.filter((match) => match.id !== matchId),
        );

        // If we're running low on matches, fetch more
        if (suggestedMatches.length <= 3 && !noMoreMatches) {
          // Fetch more in the background
          const data = await api.get("/api/match/suggest?limit=10");
          if (Array.isArray(data) && data.length > 0) {
            setSuggestedMatches((prev) => [...prev, ...data]);
          } else {
            setNoMoreMatches(true);
          }
        }
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setActionLoading(false);
      }
    },
    [actionLoading, suggestedMatches.length, noMoreMatches, toast],
  );

  if (loading) {
    return (
      <div className="page-loader">
        <span className="spinner" />
      </div>
    );
  }

  if (suggestedMatches.length === 0 && noMoreMatches) {
    return (
      <div
        className="empty-state"
        style={{ padding: "60px 20px", textAlign: "center" }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }}>💔</div>
        <h3>Không tìm thấy người phù hợp</h3>
        <p>Hãy thử lại sau hoặc cập nhật hồ sơ của bạn để tìm kiếm tốt hơn!</p>
        <button
          className="btn btn-primary"
          onClick={fetchMatches}
          style={{ marginTop: 20 }}
        >
          Thử tìm lại
        </button>
      </div>
    );
  }

  if (suggestedMatches.length === 0) {
    // This case handles when suggestedMatches becomes empty but noMoreMatches is not yet true
    // (e.g., after processing the last few matches and before the next fetch completes)
    return (
      <div className="page-loader">
        <span className="spinner" />
        <p style={{ marginTop: 16 }}>Đang tìm kiếm thêm người phù hợp...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, color: "var(--rose)", marginBottom: 4 }}>
          Khám phá
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Tìm kiếm những người thú vị xung quanh bạn
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: 20,
        }}
      >
        {suggestedMatches.map((match) => (
          <div key={match.id} className="card" style={{ overflow: "hidden" }}>
            <div
              style={{
                height: 180,
                background:
                  "linear-gradient(135deg, var(--rose) 0%, var(--rose-light) 50%, var(--gold) 100%)",
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {match.avatar_url ? (
                <img
                  src={resolveMediaUrl(match.avatar_url)}
                  alt={match.username}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                />
              ) : (
                <AvatarImg
                  src={resolveMediaUrl(match.avatar_url)}
                  name={match.username}
                  size={80}
                  style={{
                    border: "3px solid white",
                    boxShadow: "var(--shadow-md)",
                    zIndex: 1,
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "50%",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                }}
              />
              <h3
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 16,
                  fontSize: 22,
                  color: "white",
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                  zIndex: 2,
                }}
              >
                {match.username}
              </h3>
            </div>
            <div style={{ padding: "16px" }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <SentimentBadge score={match.sentiment_profile} />
                {(match.age || match.gender) && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--ink-mid)",
                      fontWeight: 500,
                    }}
                  >
                    • {match.age ? `${match.age} tuổi` : ""}{" "}
                    {match.gender === "male"
                      ? "♂️ Nam"
                      : match.gender === "female"
                        ? "♀️ Nữ"
                        : match.gender
                          ? "⚧ Khác"
                          : ""}
                  </span>
                )}
                {match.is_online && (
                  <span
                    style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}
                  >
                    ● Online
                  </span>
                )}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: match.bio ? "var(--ink-mid)" : "var(--ink-ghost)",
                  lineHeight: 1.6,
                  marginBottom: 16,
                  height: 60, // Fixed height for bio to prevent layout shifts
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {match.bio || "Chưa có giới thiệu"}
              </p>

              <div
                style={{ display: "flex", gap: 8, justifyContent: "center" }}
              >
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleAction("dislike", match.id)}
                  disabled={actionLoading}
                  style={{ flex: 1 }}
                >
                  👎 Bỏ qua
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    setActionLoading(true);
                    try {
                      await api.post(`/api/chat/start/${match.id}`);
                      navigate(`/messages/${match.id}`);
                    } catch (err) {
                      toast(err.message, "error");
                      setActionLoading(false);
                    }
                  }}
                  disabled={actionLoading}
                  style={{ flex: 1 }}
                >
                  ❤️ Nhắn tin
                </button>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => openUserProfile?.(match.id)}
                style={{ marginTop: 8, width: "100%" }}
              >
                Xem hồ sơ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
