import { useState, useEffect, useRef } from "react";
import { api, BASE_URL } from "../api";
import { useAuth } from "../AuthContext";
import { useToast } from "../ToastContext";
import { AvatarImg } from "./AvatarImg";

// Hàm resolveMediaUrl đã được định nghĩa trong FeedPage.jsx, nên có thể import hoặc định nghĩa lại cho nhất quán
const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${cleanBase}${url.startsWith("/") ? url : "/" + url}`;
};

export function StorySection() {
  const { user } = useAuth();
  const toast = useToast();

  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

  const fileRef = useRef();

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      const data = await api.get("/api/stories/");
      setStories(data || []);
    } catch (err) {
      // Nếu 401 Unauthorized, chỉ hiển thị trạng thái rỗng mà không spam toast
      if (err.status !== 401) {
        console.error("Story fetch error:", err);
      }
      setStories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const url = URL.createObjectURL(file);

    const type = file.type.startsWith("video/") ? "video" : "image";

    setPreviewMedia({
      file,
      url,
      type,
    });

    e.target.value = "";
  };

  const uploadStory = async () => {
    if (!previewMedia) return;

    setIsUploading(true);

    const fd = new FormData();
    fd.append("file", previewMedia.file);

    try {
      toast("Đang tải tin lên...", "info");

      // Bước 1: Upload file thông qua Multipart/form-data
      const uploadRes = await api.postForm("/api/stories/upload/", fd);
      // Hỗ trợ cả 2 định dạng trả về phổ biến: url hoặc media_url
      const uploadedUrl = uploadRes?.media_url || uploadRes?.url;
      if (!uploadedUrl)
        throw new Error("Không nhận được URL từ server sau khi upload");

      // Bước 2: Tạo record story với định dạng JSON đồng bộ với Post
      const storyRes = await api.post("/api/stories/", {
        media_urls: [uploadedUrl],
        media_type: previewMedia.type.startsWith("video") ? "video" : "image",
      });

      const newStory = storyRes?.story || storyRes?.data || storyRes;

      setStories((prev) => [newStory, ...prev]);

      toast("Đăng tin thành công ✨", "success");

      setPreviewMedia(null);
    } catch (err) {
      console.error(err);
      toast(err.message || "Upload thất bại", "error");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          overflowX: "auto",
          paddingBottom: 8,
        }}
      >
        {/* Nút thêm tin */}
        <div
          style={{ flexShrink: 0, textAlign: "center", cursor: "pointer" }}
          onClick={() => fileRef.current?.click()}
        >
          <div style={{ position: "relative" }}>
            <AvatarImg
              src={resolveMediaUrl(user?.avatar_url)}
              size={64}
              style={{ border: "2px solid var(--rose)" }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                background: "var(--rose)",
                color: "white",
                borderRadius: "50%",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                border: "2px solid white",
              }}
            >
              +
            </div>
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--ink-soft)" }}>
            Tin của bạn
          </div>
        </div>

        {/* Danh sách Story */}
        {loading ? (
          <div
            style={{ display: "flex", alignItems: "center", padding: "0 12px" }}
          >
            <span className="spinner" style={{ width: 20, height: 20 }} />
          </div>
        ) : (
          stories.map((s, i) => (
            <div
              key={i}
              style={{ flexShrink: 0, textAlign: "center", cursor: "pointer" }}
            >
              <div
                style={{
                  padding: 2,
                  borderRadius: "50%",
                  border: "2px solid var(--rose-pale)",
                }}
              >
                <AvatarImg
                  src={resolveMediaUrl(s.avatar_url)}
                  size={60}
                  name={s.username}
                />
              </div>
              <div
                style={{ fontSize: 11, marginTop: 4, color: "var(--ink-soft)" }}
              >
                {s.username}
              </div>
            </div>
          ))
        )}
      </div>

      <input
        type="file"
        ref={fileRef}
        onChange={handleFileSelect}
        accept="image/*,video/*"
        style={{ display: "none" }}
      />

      {/* Modal Xem trước tin trước khi upload */}
      {previewMedia && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 16 }}>Xem trước tin</h3>
            {previewMedia.type === "image" ? (
              <img
                src={previewMedia.url}
                alt="Preview"
                style={{ width: "100%", borderRadius: 12, marginBottom: 16 }}
              />
            ) : (
              <video
                src={previewMedia.url}
                controls
                style={{ width: "100%", borderRadius: 12, marginBottom: 16 }}
              />
            )}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setPreviewMedia(null)}
                disabled={isUploading}
              >
                Hủy
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 2 }}
                onClick={uploadStory}
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="spinner" style={{ width: 16, height: 16 }} />
                ) : (
                  "Đăng tin ✨"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
