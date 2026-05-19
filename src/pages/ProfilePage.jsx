import { useState, useRef, useEffect } from "react";
import { api, BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { AvatarImg } from "../components/AvatarImg";
import { ReportModal } from "../components/ReportModal";

const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:")) return url; // Giữ nguyên logic này
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${cleanBase}${url.startsWith("/") ? url : "/" + url}`; // Đảm bảo URL bắt đầu bằng /
};

function SentimentBadge({ score }) {
  if (!score) return null;
  const map = {
    positive: ["#fef3c7", "#d97706", "😊 Tích cực"],
    negative: ["#fce7f3", "#db2777", "😡 Tiêu cực"],
    neutral: ["#f1f5f9", "#64748b", "😐 Bình thường"],
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

function BlockedList() {
  const toast = useToast();
  const [blocked, setBlocked] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const load = async () => {
    if (blocked !== null) {
      setShow((s) => !s);
      return;
    }
    setLoading(true);
    try {
      // Thêm dấu /
      const data = await api.get("/api/users/me/blocked/");
      setBlocked(Array.isArray(data) ? data : []);
      setShow(true);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const unblock = async (userId) => {
    try {
      await api.delete(`/api/users/${userId}/block/`); // Thêm dấu /
      setBlocked((b) => b.filter((u) => u.blocked_id !== userId));
      toast("Đã bỏ chặn", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div>
      <button
        className="btn btn-ghost"
        onClick={load}
        disabled={loading}
        style={{ fontSize: 14 }}
      >
        {loading ? (
          <span className="spinner" style={{ width: 16, height: 16 }} />
        ) : show ? (
          "▲"
        ) : (
          "▼"
        )}{" "}
        Danh sách đã chặn
      </button>
      {show && blocked !== null && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {blocked.length === 0 ? (
            <p
              style={{
                color: "var(--ink-ghost)",
                fontSize: 14,
                padding: "8px 0",
              }}
            >
              Chưa chặn ai
            </p>
          ) : (
            blocked.map((u) => (
              <div
                key={u.blocked_id}
                className="card"
                style={{
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ fontWeight: 600 }}>{u.blocked_username}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => unblock(u.blocked_id)}
                >
                  Bỏ chặn
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Profile của người khác ───────────────────────────────────────────────────
function OtherProfile({ userId, onBack }) {
  const toast = useToast();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    api // Thêm dấu /
      .get(`/api/profile/${userId}/`)
      .then((d) => setProfile(d))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleBlock = async () => {
    if (!confirm(`Chặn ${profile?.username}?`)) return;
    setBlocking(true);
    try {
      await api.post(`/api/users/${userId}/block/`); // Thêm dấu /
      setIsBlocked(true);
      toast(`Đã chặn ${profile?.username}`, "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBlocking(false);
    }
  };

  const handleUnblock = async () => {
    setBlocking(true);
    try {
      await api.delete(`/api/users/${userId}/block/`); // Thêm dấu /
      setIsBlocked(false);
      toast("Đã bỏ chặn", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBlocking(false);
    }
  };

  if (loading)
    return (
      <div className="page-loader">
        <span className="spinner" />
      </div>
    );
  if (!profile)
    return (
      <div className="empty-state">
        <p>Không tìm thấy người dùng</p>
        <button
          className="btn btn-secondary"
          onClick={onBack}
          style={{ marginTop: 16 }}
        >
          ← Quay lại
        </button>
      </div>
    );

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "24px 20px" }}>
      <button
        className="btn btn-ghost"
        onClick={onBack}
        style={{ marginBottom: 20 }}
      >
        ← Quay lại
      </button>

      <div className="card" style={{ overflow: "hidden", marginBottom: 20 }}>
        <div
          style={{
            height: 90,
            background:
              "linear-gradient(135deg, var(--rose) 0%, var(--rose-light) 50%, var(--gold) 100%)",
          }}
        />
        <div style={{ padding: "0 24px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              marginTop: -36,
              marginBottom: 16,
            }}
          >
            <div style={{ position: "relative" }}>
              <AvatarImg
                src={resolveMediaUrl(profile.avatar_url)} // Sử dụng resolveMediaUrl
                size={72}
                style={{
                  border: "3px solid white",
                  boxShadow: "var(--shadow-md)",
                }}
              />
              {profile.is_online && (
                <div
                  className="online-dot"
                  style={{ position: "absolute", bottom: 2, right: 2 }}
                />
              )}
            </div>
            <div style={{ display: "flex", gap: 8, paddingBottom: 4 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReport(true)}
              >
                🚩 Báo cáo
              </button>
              {isBlocked ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleUnblock}
                  disabled={blocking}
                >
                  Bỏ chặn
                </button>
              ) : (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleBlock}
                  disabled={blocking}
                >
                  🚫 Chặn
                </button>
              )}
            </div>
          </div>

          <h2 style={{ fontSize: 22, marginBottom: 6 }}>{profile.username}</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <SentimentBadge score={profile.sentiment_profile} />
            {profile.age || profile.gender ? (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-mid)",
                  fontWeight: 500,
                }}
              >
                • {profile.age ? `${profile.age} tuổi` : ""}{" "}
                {profile.gender === "male"
                  ? "♂️ Nam"
                  : profile.gender === "female"
                    ? "♀️ Nữ"
                    : profile.gender
                      ? "⚧ Khác"
                      : ""}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>
                • Chưa cập nhật
              </span>
            )}
            {profile.is_online && (
              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>
                ● Online
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 14,
              color: profile.bio ? "var(--ink-mid)" : "var(--ink-ghost)",
              lineHeight: 1.7,
            }}
          >
            {profile.bio || "Chưa có giới thiệu"}
          </p>
        </div>
      </div>

      {/* Bài viết gần đây */}
      {profile.posts?.length > 0 && (
        <div>
          <h3
            style={{ fontSize: 18, marginBottom: 16, color: "var(--ink-mid)" }}
          >
            Bài viết gần đây
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {profile.posts.map((p) => (
              <div key={p.id} className="card" style={{ padding: "16px 20px" }}>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--ink-mid)",
                    marginBottom: 8,
                  }}
                >
                  {p.content}
                </p>
                {p.media_urls?.[0] && p.media_type === "image" && (
                  <img
                    src={resolveMediaUrl(p.media_urls?.[0] ?? p.media_url)}
                    alt=""
                    style={{
                      width: "100%",
                      maxHeight: 300,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                )}
                {(p.media_urls?.[0] || p.media_url) &&
                  p.media_type === "video" && (
                    <video
                      key={p.media_urls?.[0] ?? p.media_url}
                      controls
                      preload="metadata"
                      playsInline
                      src={resolveMediaUrl(p.media_urls?.[0] ?? p.media_url)}
                      style={{
                        width: "100%",
                        maxHeight: 300,
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    >
                      Trình duyệt của bạn không hỗ trợ thẻ video.
                    </video>
                  )}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--ink-ghost)" }}>
                    {(p.sentiment || p.sentiment_score) && (
                      <SentimentBadge
                        score={p.sentiment || p.sentiment_score}
                      />
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReport && (
        <ReportModal
          targetId={userId}
          targetType="user"
          targetName={profile.username}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

// ─── Profile của mình ─────────────────────────────────────────────────────────
function MyProfile() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user?.bio || "");
  const [age, setAge] = useState(user?.age || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const fileRef = useRef();

  // Styles from about.html design system
  const colors = {
    primary: "#C94C5E",
    secondary: "#FF6B8A",
    surface: "#FAFAF8",
    surfaceDim: "#E8E5E0",
    textPrimary: "#1A1A1A",
    textSecondary: "#6B6B6B",
    border: "#E8E5E0",
  };

  const styles = {
    container: {
      maxWidth: 1000,
      margin: "0 auto",
      padding: "48px 24px",
      background: colors.surface,
      minHeight: "100vh",
    },
    header: {
      textAlign: "center",
      marginBottom: 64,
    },
    title: {
      fontSize: 48,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: colors.primary,
      marginBottom: 12,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    profileCard: {
      background: "#fff",
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 32,
      marginBottom: 32,
      boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
      transition: "all 150ms ease",
    },
    profileHeader: {
      display: "flex",
      gap: 32,
      alignItems: "flex-start",
      marginBottom: 32,
      paddingBottom: 32,
      borderBottom: `1px solid ${colors.border}`,
    },
    avatarWrapper: {
      position: "relative",
      flexShrink: 0,
    },
    avatarRing: {
      width: 140,
      height: 140,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      padding: 3,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInner: {
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      background: colors.surface,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    uploadButton: {
      position: "absolute",
      bottom: 8,
      right: 8,
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      color: "#fff",
      border: "2px solid white",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      transition: "all 150ms ease",
      boxShadow: "0 4px 12px rgba(201, 76, 94, 0.25)",
    },
    userInfo: {
      flex: 1,
    },
    username: {
      fontSize: 32,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 20,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: colors.textPrimary,
      marginBottom: 16,
    },
    bioLabel: {
      fontSize: 14,
      fontWeight: 600,
      color: colors.textPrimary,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    bioText: {
      fontSize: 15,
      lineHeight: 1.7,
      color: colors.textSecondary,
    },
    textarea: {
      width: "100%",
      padding: "12px 16px",
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      fontFamily: "Inter, sans-serif",
      fontSize: 14,
      color: colors.textPrimary,
      resize: "vertical",
      marginBottom: 16,
      transition: "border-color 150ms ease",
    },
    buttonGroup: {
      display: "flex",
      gap: 12,
      marginTop: 16,
    },
    button: {
      padding: "12px 24px",
      borderRadius: 8,
      border: "none",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 150ms ease",
    },
    buttonPrimary: {
      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      color: "#fff",
    },
    buttonGhost: {
      background: colors.surface,
      color: colors.textPrimary,
      border: `1px solid ${colors.border}`,
    },
    infoCard: {
      background: "#fff",
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 24,
      transition: "all 150ms ease",
    },
    infoCardHover: {
      borderColor: colors.primary,
      boxShadow: `0 10px 15px rgba(201, 76, 94, 0.08)`,
    },
    dangerButton: {
      width: "100%",
      padding: "12px 24px",
      background: "#fee2e2",
      color: "#dc2626",
      border: "1px solid #fecaca",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 150ms ease",
    },
  };

  // Dùng PATCH /api/auth/me để cập nhật bio (sync với session)
  const saveProfile = async () => {
    setSaving(true);
    try {
      const data = await api.patch("/api/auth/me/", {
        // Thêm dấu /
        bio, // Giữ nguyên bio
        age: age ? parseInt(age) : null, // Gửi null nếu age rỗng
        gender,
      });
      updateUser({
        bio: data.bio ?? bio,
        age: data.age ?? age,
        gender: data.gender ?? gender,
      });
      setEditing(false);
      toast("Đã cập nhật hồ sơ!", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const data = await api.postForm("/api/auth/me/avatar/", fd); // Thêm dấu /

      const newAvatarUrl = data.avatar_url || data.url;
      if (newAvatarUrl) {
        updateUser({ avatar_url: newAvatarUrl });
        toast("Ảnh đại diện đã được cập nhật!", "success");
      }
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (!user) return null;

  // Fetch user posts
  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        // Thêm dấu /
        const data = await api.get("/api/posts/feed/");
        setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setPosts([]);
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchPosts();
  }, [user?.posts_count]); // Re-fetch posts khi số lượng bài viết của người dùng thay đổi

  // Đồng bộ dữ liệu từ AuthContext vào Form khi user đã load xong
  useEffect(() => {
    if (user && !editing) {
      setBio(user.bio || "");
      setAge(user.age || "");
      setGender(user.gender || "");
    }
  }, [user, editing]);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Hồ sơ của tôi</h1>
        <p style={styles.subtitle}>
          Quản lý thông tin cá nhân và cài đặt tài khoản
        </p>
      </div>

      {/* Profile Card */}
      <div style={styles.profileCard}>
        <div style={styles.profileHeader}>
          {/* Avatar */}
          <div style={styles.avatarWrapper}>
            <div style={styles.avatarRing}>
              <div style={styles.avatarInner}>
                <AvatarImg
                  src={resolveMediaUrl(user.avatar_url)} // Sử dụng resolveMediaUrl
                  name={user.username}
                  size={134}
                />
              </div>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={styles.uploadButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
              title="Cập nhật ảnh đại diện"
            >
              {uploading ? "⏳" : "📷"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={uploadAvatar}
            />
          </div>

          {/* User Info */}
          <div style={styles.userInfo}>
            <h2 style={styles.username}>{user.username}</h2>
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <SentimentBadge score={user?.sentiment_profile} />
              {user?.age || user?.gender ? (
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--ink-mid)",
                    fontWeight: 500,
                  }}
                >
                  • {user?.age ? `${user.age} tuổi` : ""}{" "}
                  {user?.gender === "male"
                    ? "Nam"
                    : user?.gender === "female"
                      ? "Nữ"
                      : user?.gender
                        ? "Khác"
                        : ""}
                </span>
              ) : (
                <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>
                  • Chưa cập nhật
                </span>
              )}
              <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>
                ● Đang hoạt động
              </span>
            </div>
            {!editing && (
              <button
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                }}
                onClick={() => {
                  setEditing(true);
                  setBio(user.bio || "");
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow =
                    "0 10px 20px rgba(201, 76, 94, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                ✏️ Chỉnh sửa hồ sơ
              </button>
            )}
          </div>
        </div>

        {/* Bio Section */}
        <div>
          {editing ? (
            <div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.bioLabel}>Tuổi</div>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    style={styles.textarea}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.bioLabel}>Giới tính</div>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    style={{ ...styles.textarea, height: 46 }}
                  >
                    <option value="">Chọn...</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>
              <div style={styles.bioLabel}>Giới thiệu bản thân</div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                placeholder="Chia sẻ về bản thân bạn..."
                style={styles.textarea}
                onFocus={(e) => (e.target.style.borderColor = colors.primary)}
                onBlur={(e) => (e.target.style.borderColor = colors.border)}
                autoFocus
              />
              <div style={styles.buttonGroup}>
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonPrimary,
                  }}
                  onClick={saveProfile}
                  disabled={saving}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.transform = "scale(1.05)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 12px rgba(201, 76, 94, 0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {saving ? "⏳ Đang lưu..." : "✓ Lưu"}
                </button>
                <button
                  style={{
                    ...styles.button,
                    ...styles.buttonGhost,
                  }}
                  onClick={() => setEditing(false)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.border;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = colors.surface;
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.bioLabel}>Giới thiệu bản thân</div>
              <p style={styles.bioText}>
                {user.bio ||
                  "💭 Chưa có giới thiệu. Thêm bio để AI hiểu bạn hơn và tìm người phù hợp!"}
              </p>
            </>
          )}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 32,
            paddingTop: 32,
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 28,
                fontFamily: "Playfair Display, serif",
                fontWeight: 700,
                color: colors.primary,
                marginBottom: 4,
              }}
            >
              {user.posts_count || 0}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Bài viết
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 28,
                fontFamily: "Playfair Display, serif",
                fontWeight: 700,
                color: colors.primary,
                marginBottom: 4,
              }}
            >
              {user.followers_count || 0}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Người theo dõi
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 28,
                fontFamily: "Playfair Display, serif",
                fontWeight: 700,
                color: colors.primary,
                marginBottom: 4,
              }}
            >
              {user.following_count || 0}
            </div>
            <div
              style={{
                fontSize: 12,
                color: colors.textSecondary,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Đang theo dõi
            </div>
          </div>
        </div>
      </div>

      {/* Highlights Section */}
      <div style={{ marginBottom: 48 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: colors.textSecondary,
            marginBottom: 16,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Khoảnh khắc yêu thích
        </div>
        <div
          style={{
            display: "flex",
            gap: 24,
            overflowX: "auto",
            paddingBottom: 12,
          }}
        >
          <button
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              background: "none",
              border: "none",
              cursor: "pointer",
              group: true,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: `2px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                transition: "all 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.primary;
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(201, 76, 94, 0.15)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ➕
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: colors.textPrimary,
              }}
            >
              Tạo
            </span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          gap: 32,
          marginBottom: 32,
          paddingBottom: 16,
          borderBottom: `1px solid ${colors.border}`,
        }}
      >
        {["posts", "saved", "tagged"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              padding: "8px 0",
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 500,
              color: activeTab === tab ? colors.primary : colors.textSecondary,
              cursor: "pointer",
              position: "relative",
              transition: "color 150ms ease",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {tab === "posts" && "📷 Bài viết"}
            {tab === "saved" && "💾 Đã lưu"}
            {tab === "tagged" && "🏷️ Được gắn thẻ"}
            {activeTab === tab && (
              <div
                style={{
                  position: "absolute",
                  bottom: -16,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: `linear-gradient(90deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Posts Grid */}
      {activeTab === "posts" && (
        <div>
          {loadingPosts ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <p style={{ color: colors.textSecondary }}>
                Đang tải bài viết...
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                background: "#fff",
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  border: `2px solid ${colors.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 40,
                  margin: "0 auto 24px",
                }}
              >
                📸
              </div>
              <h3
                style={{
                  fontSize: 20,
                  fontFamily: "Playfair Display, serif",
                  fontWeight: 700,
                  color: colors.textPrimary,
                  marginBottom: 8,
                }}
              >
                Chia sẻ khoảnh khắc của bạn
              </h3>
              <p style={{ color: colors.textSecondary, marginBottom: 24 }}>
                Đăng ảnh hoặc video để kết nối với mọi người
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 16,
              }}
            >
              {posts.map((post) => (
                <div
                  key={post.id}
                  style={{
                    aspectRatio: "1",
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    overflow: "hidden",
                    background: colors.surface,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 150ms ease",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.primary;
                    e.currentTarget.style.boxShadow = `0 10px 15px rgba(201, 76, 94, 0.1)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {post.media_urls?.[0] && post.media_type === "image" ? (
                    <img
                      src={resolveMediaUrl(
                        post.media_urls?.[0] ?? post.media_url,
                      )}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (post.media_urls?.[0] || post.media_url) &&
                    post.media_type === "video" ? (
                    <video
                      key={post.media_urls?.[0] ?? post.media_url}
                      controls
                      preload="metadata"
                      playsInline
                      src={resolveMediaUrl(
                        post.media_urls?.[0] ?? post.media_url,
                      )}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    >
                      Trình duyệt của bạn không hỗ trợ thẻ video.
                    </video>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
                      <p
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          maxWidth: "80%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {post.content?.substring(0, 20)}...
                      </p>
                    </div>
                  )}
                  {/* Overlay with reactions count */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: "rgba(0, 0, 0, 0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0,
                      transition: "opacity 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0";
                    }}
                  >
                    <div style={{ textAlign: "center", color: "#fff" }}>
                      <div style={{ fontSize: 20 }}>❤️</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {post.reactions_count || 0}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Saved & Tagged Tabs (placeholder) */}
      {(activeTab === "saved" || activeTab === "tagged") && (
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 16 }}>
            {activeTab === "saved" ? "💾" : "🏷️"}
          </div>
          <p style={{ color: colors.textSecondary }}>
            {activeTab === "saved"
              ? "Chưa lưu bài viết nào"
              : "Chưa có bài viết nào được gắn thẻ"}
          </p>
        </div>
      )}

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: colors.border,
          margin: "48px 0",
        }}
      />

      {/* AI Analysis Card */}
      <div
        style={styles.infoCard}
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, styles.infoCardHover)
        }
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.boxShadow =
            "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)";
        }}
      >
        <h3 style={styles.sectionTitle}>🤖 Phân tích cảm xúc AI</h3>
        <p style={styles.bioText}>
          {user.sentiment_profile ? (
            <>
              AI đã phân tích bài viết của bạn và xác định bạn có xu hướng{" "}
              <strong style={{ color: colors.primary }}>
                {user.sentiment_profile === "positive"
                  ? "tích cực 💫"
                  : user.sentiment_profile === "negative"
                    ? "tiêu cực 💔"
                    : "trung lập 😐"}
              </strong>
              . Hệ thống dùng điều này để ghép bạn với những người phù hợp.
            </>
          ) : (
            "📝 Hãy đăng thêm bài viết để AI phân tích cảm xúc và tối ưu hóa ghép đôi!"
          )}
        </p>
      </div>

      {/* Blocked List Card */}
      <div
        style={styles.infoCard}
        onMouseEnter={(e) =>
          Object.assign(e.currentTarget.style, styles.infoCardHover)
        }
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.boxShadow =
            "0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)";
        }}
      >
        <h3 style={styles.sectionTitle}>🚫 Quản lý chặn</h3>
        <BlockedList />
      </div>

      {/* Logout Card */}
      <div style={styles.profileCard}>
        <button
          style={styles.dangerButton}
          onClick={logout}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#fecaca";
            e.currentTarget.style.color = "#b91c1c";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fee2e2";
            e.currentTarget.style.color = "#dc2626";
          }}
        >
          🚪 Đăng xuất
        </button>
      </div>
    </div>
  );
}

// ─── Export chính ─────────────────────────────────────────────────────────────
export function ProfilePage({ viewUserId, onBack }) {
  const { user } = useAuth();
  // Xem profile người khác nếu viewUserId khác id mình
  if (viewUserId && viewUserId !== user?.id) {
    return <OtherProfile userId={viewUserId} onBack={onBack} />;
  }
  return <MyProfile />;
}
