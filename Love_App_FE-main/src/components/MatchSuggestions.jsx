import React, { useState, useEffect, useCallback } from "react"; // Added useCallback
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { api } from "../api";
import { normalizeEmotionMatch } from "../emotionMatchAdapter";
// import { AvatarImg } from "./AvatarImg"; // AvatarImg component is no longer directly used here, replaced by custom JSX
export function MatchSuggestions({ setPage, setChatMatch }) {
  const navigate = useNavigate(); // Initialize useNavigate
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/match/suggest?limit=10"); // Đảm bảo không có dấu '/' ở cuối
        const data = normalizeEmotionMatch(response);
        setMatches(data);
      } catch (error) {
        console.error("Lỗi khi lấy gợi ý ghép đôi:", error);
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const showNextUser = useCallback(() => {
    setCurrentIndex((prev) => prev + 1);
  }, []);

  const handleSkip = () => {
    showNextUser();
  };

  const handleChat = async (user) => {
    try {
      // Gọi API tạo cuộc trò chuyện
      await api.post(`/api/chat/start/${user.id}`);
      // Chuyển sang trang nhắn tin
      navigate(`/messages/${user.id}`);
    } catch (error) {
      console.error("Không thể bắt đầu cuộc trò chuyện:", error);
      alert("Không thể mở cuộc trò chuyện.");
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>Đang tải...</div>
    );
  }

  const currentUser = matches[currentIndex];

  // Nếu rỗng hoặc đã xem hết danh sách
  if (!matches || matches.length === 0 || currentIndex >= matches.length) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "var(--ink-ghost)",
        }}
      >
        No matches
      </div>
    );
  }

  return (
    <div
      className="match-card"
      style={{
        padding: "24px",
        textAlign: "center",
        background: "#fff",
        borderRadius: "16px",
        boxShadow: "var(--shadow-md)",
        margin: "64px 16px 16px", // Added top margin to accommodate -mt-16 avatar
      }}
    >
      <div className="flex justify-center -mt-16 mb-4">
        <img
          src={currentUser.avatar_url}
          alt=""
          className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      </div>
      <h2 style={{ marginTop: "16px", fontSize: "20px", fontWeight: "700" }}>
        {currentUser.name || currentUser.username},{" "}
        {currentUser.user2_age || "??"}
      </h2>
      <p
        style={{
          color: "var(--ink-soft)",
          fontSize: "14px",
          marginBottom: "20px",
        }}
      >
        {currentUser.bio || currentUser.user2_bio || "Không có tiểu sử"}
      </p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handleChat(currentUser)}
          className="btn btn-primary"
        >
          💬 Nhắn tin
        </button>

        <button
          onClick={handleSkip}
          className="bg-gray-300 px-4 py-2 rounded-lg"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
}
