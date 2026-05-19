import { useState, useEffect, useRef, useCallback } from "react";
import { api, BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { AvatarImg } from "../components/AvatarImg";
import { ReportModal } from "../components/ReportModal";
import { timeAgo } from "../dateUtils";
import { StorySection } from "../components/StorySection";

const REACTIONS = [
  { key: "heart", emoji: "❤️" },
  { key: "haha", emoji: "😂" },
  { key: "wow", emoji: "😮" },
  { key: "sad", emoji: "😢" },
  { key: "fire", emoji: "🔥" },
];

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/mpeg",
  "video/avi",
];
const ALLOWED_UPLOAD_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:")
  )
    return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`; // Đảm bảo URL bắt đầu bằng /
  return `${cleanBase}${cleanUrl}`; // Sử dụng BASE_URL đã cấu hình
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function inferMediaCategory(type) {
  if (!type) return null;
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type === "image" || type === "video") return type;
  return null;
}

function inferMimeTypeByExtension(filename) {
  if (!filename) return null;
  const ext = filename.split(".").pop()?.toLowerCase();
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
  };
  return map[ext] || null;
}

function getFileMimeType(file) {
  return file.type || inferMimeTypeByExtension(file.name);
}

function SentimentBadge({ score }) {
  if (!score) return null;
  const map = {
    positive: ["sentiment-positive", "😊 Tích cực"],
    negative: ["sentiment-negative", "😡 Tiêu cực"],
    neutral: ["sentiment-neutral", "😐 Bình thường"],
    analyzing: ["sentiment-neutral", "🤖 Đang phân tích..."],
  };
  const [cls, label] = map[score] || map.neutral;
  return <span className={`sentiment-badge ${cls}`}>{label}</span>;
}

function ReactionBar({ reactions, postId, onUpdate }) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setShow(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const total = REACTIONS.reduce((s, r) => s + (reactions?.[r.key] || 0), 0);
  const myReaction = REACTIONS.find((r) => r.key === reactions?.my_reaction);

  const react = async (type) => {
    setShow(false);
    try {
      // POST /api/posts/:id/react  → toggle logic
      const data = await api.post(`/api/posts/${postId}/react/`, {
        // Thêm dấu /
        reaction_type: type,
      });
      onUpdate(data);
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setShow((s) => !s)}
        style={{
          color: myReaction ? "var(--rose)" : "var(--ink-soft)",
          fontWeight: myReaction ? 700 : 500,
        }}
      >
        {myReaction ? myReaction.emoji : "🤍"} {total > 0 ? total : ""} React
      </button>
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "110%",
            left: 0,
            zIndex: 20,
            background: "white",
            borderRadius: 100,
            padding: "6px 12px",
            display: "flex",
            gap: 4,
            boxShadow: "var(--shadow-md)",
            border: "1px solid var(--border)",
            animation: "slideDown 0.15s ease",
          }}
        >
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              onClick={() => react(r.key)}
              title={r.key}
              style={{
                fontSize: 22,
                padding: "4px 6px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                background:
                  reactions?.my_reaction === r.key
                    ? "var(--rose-pale)"
                    : "transparent",
                transition: "transform 0.1s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.transform = "scale(1.3)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            >
              {r.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentSection({ postId, onCountChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // GET /api/posts/:id/comments
    api
      .get(`/api/posts/${postId}/comments/?page=1&page_size=20`) // Thêm dấu /
      .then((d) => {
        const list = d.comments || [];
        setComments(list);
        onCountChange?.(d.total ?? list.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      // POST /api/posts/:id/comments
      const c = await api.post(`/api/posts/${postId}/comments/`, {
        // Thêm dấu /
        content: text.trim(),
      });
      setComments((cs) => [c, ...cs]);
      onCountChange?.((n) => (typeof n === "number" ? n + 1 : 1));
      setText("");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (id) => {
    try {
      // DELETE /api/posts/comments/:id
      await api.delete(`/api/posts/comments/${id}/`); // Thêm dấu /
      setComments((cs) => cs.filter((c) => c.id !== id));
      onCountChange?.((n) => (typeof n === "number" ? Math.max(0, n - 1) : 0));
    } catch (err) {
      toast(err.message, "error");
    }
  };

  return (
    <div
      style={{
        padding: "12px 20px 16px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <form
        onSubmit={submit}
        style={{ display: "flex", gap: 10, marginBottom: 12 }}
      >
        <AvatarImg src={user?.avatar_url} name={user?.username} size={30} />
        <input
          className="input-field"
          placeholder="Viết bình luận..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ padding: "8px 14px", fontSize: 13 }}
        />
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={submitting || !text.trim()}
        >
          {submitting ? "…" : "↑"}
        </button>
      </form>

      {loading ? (
        <div style={{ textAlign: "center", padding: 8 }}>
          <span className="spinner" style={{ width: 16, height: 16 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <AvatarImg src={c.avatar_url} name={c.username} size={28} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    background: "var(--cream)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ fontWeight: 600, marginRight: 6 }}>
                    {c.username}
                  </span>
                  {c.content}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 4,
                    paddingLeft: 12,
                  }}
                >
                  <span style={{ fontSize: 11, color: "var(--ink-ghost)" }}>
                    {timeAgo(c.created_at)}
                  </span>
                  {c.user_id === user?.id && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      style={{
                        fontSize: 11,
                        color: "var(--rose)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onDelete, openUserProfile }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reactions, setReactions] = useState(post.reactions || {});
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count || 0);
  const [deleting, setDeleting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm("Xóa bài viết này?")) return;
    setDeleting(true);
    try {
      // DELETE /api/posts/:id
      await api.delete(`/api/posts/${post.id}`);
      onDelete(post.id);
      toast("Đã xóa bài viết", "success");
    } catch (err) {
      toast(err.message, "error");
      setDeleting(false);
    }
  };

  const isOwner = post.user_id === user?.id;

  return (
    <div className="card" style={{ animation: "fadeUp 0.35s ease" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
        }}
      >
        <button
          onClick={() => openUserProfile?.(post.user_id)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <AvatarImg
            src={resolveMediaUrl(post.avatar_url)}
            name={post.username}
            size={42}
          />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => openUserProfile?.(post.user_id)}
              style={{
                fontWeight: 700,
                fontSize: 15,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: "var(--ink)",
              }}
            >
              {post.username}
            </button>
            <SentimentBadge score={post.sentiment || post.sentiment_score} />
            {post?.age || post?.gender ? (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--ink-ghost)",
                  fontWeight: 500,
                }}
              >
                • {post?.age ? `${post.age} tuổi` : ""}{" "}
                {post?.gender === "male"
                  ? "♂️ Nam"
                  : post?.gender === "female"
                    ? "♀️ Nữ"
                    : post?.gender
                      ? "⚧ Khác"
                      : ""}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-ghost)" }}>
                • Chưa cập nhật
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-ghost)" }}>
            {timeAgo(post.created_at)}
          </span>
        </div>

        {/* 3-dot menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setMenuOpen((s) => !s)}
            style={{ fontSize: 18, color: "var(--ink-ghost)" }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "110%",
                right: 0,
                zIndex: 20,
                background: "white",
                borderRadius: 12,
                padding: "6px",
                boxShadow: "var(--shadow-md)",
                border: "1px solid var(--border)",
                minWidth: 160,
                animation: "slideDown 0.15s ease",
              }}
            >
              {isOwner ? (
                <button
                  className="btn btn-ghost"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    color: "var(--rose)",
                    fontSize: 14,
                  }}
                >
                  🗑️ Xóa bài viết
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowReport(true);
                  }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    fontSize: 14,
                  }}
                >
                  🚩 Báo cáo bài viết
                </button>
              )}
              {!isOwner && (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setMenuOpen(false);
                    openUserProfile?.(post.user_id);
                  }}
                  style={{
                    width: "100%",
                    justifyContent: "flex-start",
                    fontSize: 14,
                  }}
                >
                  👤 Xem hồ sơ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {post.content && (
        <div
          style={{
            padding: "0 20px 16px",
            fontSize: 15,
            lineHeight: 1.75,
            color: "var(--ink-mid)",
          }}
        >
          {post.content}
        </div>
      )}

      {/* Media (Render media_urls) */}
      {((post.media_urls && post.media_urls.length > 0) || post.media_url) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {post.media_type === "image" &&
            (post.media_urls || [post.media_url]).map((url, idx) => (
              <img
                key={idx}
                src={resolveMediaUrl(url)}
                alt=""
                style={{ width: "100%", maxHeight: 500, objectFit: "cover" }}
              />
            ))}
          {post.media_type === "video" && (
            <video
              key={post.media_urls?.[0] ?? post.media_url}
              controls
              preload="metadata"
              playsInline
              src={resolveMediaUrl(post.media_urls?.[0] ?? post.media_url)}
              className="w-full rounded-xl"
              style={{ maxHeight: 480 }}
            >
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      )}

      {/* Reaction counts */}
      {REACTIONS.some((r) => reactions[r.key] > 0) && (
        <div
          style={{
            padding: "8px 20px 0",
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {REACTIONS.filter((r) => reactions[r.key] > 0).map((r) => (
            <span
              key={r.key}
              style={{ fontSize: 13, color: "var(--ink-soft)" }}
            >
              {r.emoji} {reactions[r.key]}
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 12px",
          borderTop: "1px solid var(--border)",
          marginTop: 8,
        }}
      >
        <ReactionBar
          reactions={reactions}
          postId={post.id}
          onUpdate={setReactions}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowComments((s) => !s)}
          style={{ color: showComments ? "var(--rose)" : "var(--ink-soft)" }}
        >
          💬 {commentCount > 0 ? commentCount : ""} Bình luận
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <CommentSection postId={post.id} onCountChange={setCommentCount} />
      )}

      {/* Report modal */}
      {showReport && (
        <ReportModal
          targetId={post.id}
          targetType="post"
          targetName={`bài viết của @${post.username}`}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}

function CreatePost({ onPost }) {
  const { user, refetch, updateUser } = useAuth();
  const toast = useToast();
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [mediaMimeType, setMediaMimeType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(); // Ref cho input chọn file
  const selectedFileRef = useRef(null); // Ref để lưu đối tượng File thực tế

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileMimeType = getFileMimeType(file);
    if (!ALLOWED_UPLOAD_TYPES.includes(fileMimeType)) {
      toast(
        "File không hợp lệ. Chỉ hỗ trợ JPEG/PNG/WEBP/GIF/MP4/WEBM/MOV.",
        "error",
      );
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast(`File vượt quá 10MB (${formatBytes(file.size)}).`, "error");
      e.target.value = "";
      return;
    }

    // Lưu đối tượng File thực tế để gửi đi khi submit
    selectedFileRef.current = file;
    // Tạo URL blob để hiển thị preview ngay lập tức
    setMediaUrl(URL.createObjectURL(file));
    setMediaType(fileMimeType.startsWith("video/") ? "video" : "image");
    setMediaMimeType(fileMimeType); // Giữ lại mime type gốc

    e.target.value = ""; // Xóa giá trị input file để có thể chọn lại cùng file
  };

  const hasContent = content.trim().length > 0;
  const hasMedia = !!(selectedFileRef.current && mediaUrl);

  const submit = async () => {
    if (!hasContent && !hasMedia) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("content", content.trim());
      if (selectedFileRef.current) {
        // Đảm bảo tên field là 'file' khớp với Backend UploadFile
        fd.append("file", selectedFileRef.current);
        fd.append("media_type", mediaType);
      }

      toast("Đang đăng bài viết...", "info");
      // Gửi bằng FormData, để trình duyệt tự set boundary
      const post = await api.postForm("/api/posts/", fd);

      // Append post mới vào state
      const finalPost = post?.post || post?.data || post;
      if (finalPost && (finalPost.id || finalPost._id)) {
        onPost(finalPost);
      } else {
        onPost(post);
      }

      // Cập nhật số lượng bài viết ngay lập tức trên UI (Optimistic Update)
      if (user && typeof updateUser === "function") {
        updateUser({ posts_count: (user.posts_count || 0) + 1 });
      }

      // Reset form sau khi đăng thành công
      setContent("");
      setMediaUrl(null);
      setMediaType(null);
      setMediaMimeType(null);
      selectedFileRef.current = null; // Xóa file đã chọn

      if (refetch) refetch(); // Đồng bộ lại thông tin user từ server (nếu cần)
      toast("Đã đăng bài thành công! ✨", "success");
    } catch (err) {
      toast(
        err.response?.data?.detail || err.message || "Đăng bài thất bại",
        "error",
      );
    } finally {
      setSubmitting(false); // Kết thúc quá trình submit
    }
  };

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <AvatarImg
          src={resolveMediaUrl(user?.avatar_url)}
          name={user?.username}
          size={42}
        />
        <div style={{ flex: 1 }}>
          <textarea
            className="input-field"
            placeholder={`${user?.username} ơi, bạn đang nghĩ gì vậy?`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{ marginBottom: 10 }}
          />

          {mediaUrl && (
            <div
              style={{
                position: "relative",
                marginBottom: 10,
                display: "inline-block",
              }}
            >
              {mediaType === "image" ? (
                <img
                  src={mediaUrl} // Sử dụng URL blob để preview
                  alt="Media Preview"
                  style={{
                    maxHeight: 200,
                    borderRadius: 10,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <video
                  key={mediaUrl}
                  controls
                  preload="metadata"
                  playsInline
                  src={mediaUrl} // Sử dụng URL blob để preview
                  className="w-full rounded-xl"
                  style={{ maxHeight: 200 }}
                >
                  Trình duyệt của bạn không hỗ trợ thẻ video.
                </video>
              )}
              <button
                onClick={() => {
                  setMediaUrl(null);
                  setMediaType(null);
                  setMediaMimeType(null);
                  selectedFileRef.current = null; // Xóa file đã chọn
                }}
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  background: "rgba(0,0,0,0.55)",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  cursor: "pointer",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting} // Disable khi đang submit
            >
              {submitting ? (
                <span className="spinner" style={{ width: 14, height: 14 }} />
              ) : (
                "📷"
              )}{" "}
              Ảnh/Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <button
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || (!hasContent && !hasMedia)} // Disable nếu không có nội dung và không có media
            >
              {submitting ? (
                <span className="spinner" style={{ width: 16, height: 16 }} />
              ) : (
                "✨ Đăng bài"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedPage({ openUserProfile }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [curPage, setCurPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const toast = useToast();

  const loadPosts = useCallback(
    async (pg = 1, append = false) => {
      pg === 1 ? setLoading(true) : setLoadingMore(true);
      try {
        const data = await api.get(`/api/posts/?page=${pg}&page_size=15`);
        const fetched = data?.posts || (Array.isArray(data) ? data : []);
        setPosts((p) => (append ? [...p, ...fetched] : fetched));
        setHasMore(fetched.length === 15);
        setCurPage(pg);
      } catch (err) {
        // Requirement 3: Không báo lỗi rầm rộ nếu là API lấy feed công khai
        console.error(
          "Failed to load posts:",
          err.response?.data || err.message,
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    loadPosts(1);
  }, [loadPosts]);

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "24px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, color: "var(--rose)", marginBottom: 4 }}>
          Trang chủ
        </h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Khám phá câu chuyện của mọi người
        </p>
      </div>

      <StorySection />

      <CreatePost onPost={(p) => setPosts((prev) => [p, ...prev])} />

      {loading ? (
        <div className="page-loader">
          <span className="spinner" />
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌸</div>
          <h3>Chưa có bài viết nào</h3>
          <p>Hãy là người đầu tiên chia sẻ cảm xúc của bạn!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((p, i) => (
            <div
              key={p.id}
              style={{ animationDelay: `${Math.min(i, 5) * 0.05}s` }}
            >
              <PostCard
                post={p}
                onDelete={(id) =>
                  setPosts((prev) => prev.filter((x) => x.id !== id))
                }
                openUserProfile={openUserProfile}
              />
            </div>
          ))}
          {hasMore && (
            <div style={{ textAlign: "center", padding: 16 }}>
              <button
                className="btn btn-secondary"
                onClick={() => loadPosts(curPage + 1, true)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  "Xem thêm bài viết"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
