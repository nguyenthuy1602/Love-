import { useState } from "react";
import { AvatarImg } from "../components/AvatarImg";

export function AboutPage({ onClose }) {
  const [activeTab, setActiveTab] = useState("about");

  const styles = {
    container: {
      maxWidth: 1200,
      margin: "0 auto",
      padding: "48px 24px",
      fontFamily: "Inter, sans-serif",
    },
    header: {
      textAlign: "center",
      marginBottom: 64,
    },
    title: {
      fontSize: 56,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: "#C94C5E",
      marginBottom: 12,
      letterSpacing: -1,
    },
    subtitle: {
      fontSize: 18,
      color: "#6B6B6B",
      marginBottom: 24,
      maxWidth: 600,
      margin: "0 auto",
    },
    tabContainer: {
      display: "flex",
      gap: 40,
      marginBottom: 48,
      borderBottom: "1px solid #E8E5E0",
      paddingBottom: 16,
    },
    tab: {
      fontSize: 16,
      fontWeight: 500,
      color: "#6B6B6B",
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "8px 0",
      position: "relative",
      transition: "color 150ms ease",
    },
    tabActive: {
      color: "#C94C5E",
      fontWeight: 600,
    },
    tabUnderline: {
      position: "absolute",
      bottom: -16,
      left: 0,
      right: 0,
      height: 2,
      background: "linear-gradient(90deg, #C94C5E 0%, #FF6B8A 100%)",
    },
    section: {
      marginBottom: 48,
    },
    sectionTitle: {
      fontSize: 28,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: "#1A1A1A",
      marginBottom: 24,
    },
    sectionText: {
      fontSize: 16,
      lineHeight: 1.7,
      color: "#1A1A1A",
      marginBottom: 16,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: 24,
      marginTop: 24,
    },
    card: {
      padding: 24,
      borderRadius: 12,
      background: "#FAFAF8",
      border: "1px solid #E8E5E0",
      transition: "all 150ms ease",
      cursor: "pointer",
    },
    cardHover: {
      borderColor: "#C94C5E",
      boxShadow: "0 10px 15px rgba(201, 76, 94, 0.08)",
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: "Playfair Display, serif",
      fontWeight: 700,
      color: "#C94C5E",
      marginBottom: 12,
    },
    cardText: {
      fontSize: 14,
      color: "#6B6B6B",
      lineHeight: 1.6,
    },
    featureList: {
      display: "grid",
      gap: 16,
      marginTop: 24,
    },
    featureItem: {
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    },
    featureIcon: {
      fontSize: 24,
      minWidth: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
    },
    featureContent: {
      flex: 1,
    },
    featureTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: "#1A1A1A",
      marginBottom: 4,
    },
    featureDesc: {
      fontSize: 14,
      color: "#6B6B6B",
      lineHeight: 1.6,
    },
    teamGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      gap: 32,
      marginTop: 32,
    },
    teamMember: {
      textAlign: "center",
    },
    teamAvatar: {
      width: 120,
      height: 120,
      borderRadius: "50%",
      margin: "0 auto 16px",
      background: "linear-gradient(135deg, #C94C5E 0%, #FF6B8A 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 48,
      boxShadow: "0 4px 12px rgba(201, 76, 94, 0.25)",
    },
    teamName: {
      fontSize: 16,
      fontWeight: 600,
      color: "#1A1A1A",
      marginBottom: 4,
    },
    teamRole: {
      fontSize: 14,
      color: "#6B6B6B",
    },
    ctaButton: {
      display: "inline-block",
      padding: "12px 32px",
      background: "linear-gradient(135deg, #C94C5E 0%, #FF6B8A 100%)",
      color: "#fff",
      borderRadius: 12,
      border: "none",
      fontSize: 16,
      fontWeight: 600,
      cursor: "pointer",
      transition: "all 150ms ease",
      marginTop: 24,
    },
    closeButton: {
      position: "fixed",
      top: 24,
      right: 24,
      width: 40,
      height: 40,
      borderRadius: "50%",
      background: "#FAFAF8",
      border: "1px solid #E8E5E0",
      fontSize: 20,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 150ms ease",
    },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8" }}>
      {onClose && (
        <button
          onClick={onClose}
          style={styles.closeButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#E8E5E0";
            e.currentTarget.style.borderColor = "#C94C5E";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#FAFAF8";
            e.currentTarget.style.borderColor = "#E8E5E0";
          }}
        >
          ✕
        </button>
      )}

      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Aura ❤️</h1>
          <p style={styles.subtitle}>
            Nền tảng kết nối yêu thương - nơi những trái tim cùng nhịp tìm thấy
            nhau
          </p>
        </div>

        {/* Tabs */}
        <div style={styles.tabContainer}>
          {["about", "features", "team", "contact"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
            >
              {tab === "about" && "Về Chúng Tôi"}
              {tab === "features" && "Tính Năng"}
              {tab === "team" && "Đội Ngũ"}
              {tab === "contact" && "Liên Hệ"}
              {activeTab === tab && <div style={styles.tabUnderline} />}
            </button>
          ))}
        </div>

        {/* About Tab */}
        {activeTab === "about" && (
          <div>
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Tầm Nhìn</h2>
              <p style={styles.sectionText}>
                Aura được tạo ra với một mục đích đơn giản nhưng sâu sắc: tạo
                một không gian an toàn, lành mạnh và đẹp đẽ cho những người tìm
                kiếm kết nối yêu thương thật sự. Trong thế giới số ngày nay,
                chúng tôi tin rằng công nghệ nên kết nối các trái tim, không
                phải cô lập chúng.
              </p>
            </div>

            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>Giá Trị Cốt Lõi</h2>
              <div style={styles.featureList}>
                {[
                  {
                    icon: "💎",
                    title: "Trung Thực",
                    desc: "Chúng tôi tin vào những kết nối thật sự, dựa trên sự tôn trọng và chân thành.",
                  },
                  {
                    icon: "🛡️",
                    title: "An Toàn",
                    desc: "Bảo vệ dữ liệu và quyền riêng tư của bạn là ưu tiên hàng đầu.",
                  },
                  {
                    icon: "🌈",
                    title: "Đa Dạng",
                    desc: "Chúng tôi tôn trọng mọi người, mọi giới tính, mọi tình yêu.",
                  },
                  {
                    icon: "❤️",
                    title: "Yêu Thương",
                    desc: "Mọi thứ chúng tôi làm đều được xúc động bởi yêu thương và sự quan tâm.",
                  },
                ].map((item, i) => (
                  <div key={i} style={styles.featureItem}>
                    <div style={styles.featureIcon}>{item.icon}</div>
                    <div style={styles.featureContent}>
                      <div style={styles.featureTitle}>{item.title}</div>
                      <div style={styles.featureDesc}>{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Features Tab */}
        {activeTab === "features" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Tính Năng Nổi Bật</h2>
            <div style={styles.grid}>
              {[
                {
                  title: "💘 Ghép Đôi Thông Minh",
                  text: "Sử dụng AI để tìm những người hợp với bạn dựa trên sở thích và tính cách.",
                },
                {
                  title: "💬 Trò Chuyện Tức Thì",
                  text: "Kết nối với những người bạn yêu thích thông qua tin nhắn an toàn và riêng tư.",
                },
                {
                  title: "📸 Chia Sẻ Khoảnh Khắc",
                  text: "Đăng ảnh, video và câu chuyện của bạn để thể hiện bản thân thật sự.",
                },
                {
                  title: "⭐ Phản Ứng Tích Cực",
                  text: "Bày tỏ cảm xúc của bạn với những phản ứng và bình luận có ý nghĩa.",
                },
                {
                  title: "🔐 Kiểm Duyệt Nội Dung",
                  text: "Cộng đồng chăm sóc được kiểm duyệt để duy trì một môi trường tích cực.",
                },
                {
                  title: "🎯 Kiểm Soát Toàn Bộ",
                  text: "Bạn sở hữu dữ liệu của mình và có thể kiểm soát cách nó được sử dụng.",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  style={styles.card}
                  onMouseEnter={(e) => {
                    Object.assign(e.currentTarget.style, styles.cardHover);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E8E5E0";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={styles.cardTitle}>{feature.title}</div>
                  <div style={styles.cardText}>{feature.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === "team" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Đội Ngũ Của Chúng Tôi</h2>
            <div style={styles.teamGrid}>
              {[
                { name: "Thúy", role: "Nhà Sáng Lập & CEO", icon: "👩‍💼" },
                { name: "Hiếu", role: "Kỹ Sư Trưởng", icon: "👨‍💻" },
                { name: "Minh", role: "Thiết Kế UX/UI", icon: "🎨" },
              ].map((member, i) => (
                <div key={i} style={styles.teamMember}>
                  <div style={styles.teamAvatar}>{member.icon}</div>
                  <div style={styles.teamName}>{member.name}</div>
                  <div style={styles.teamRole}>{member.role}</div>
                </div>
              ))}
            </div>
            <p
              style={{
                ...styles.sectionText,
                marginTop: 32,
                textAlign: "center",
              }}
            >
              Chúng tôi là một đội ngũ nhỏ nhưng đam mê, tận tâm với sứ mệnh tạo
              ra một nền tảng kết nối yêu thương thực sự.
            </p>
          </div>
        )}

        {/* Contact Tab */}
        {activeTab === "contact" && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Liên Hệ Với Chúng Tôi</h2>
            <p style={styles.sectionText}>
              Bạn có câu hỏi, phản hồi hoặc muốn hợp tác? Chúng tôi rất muốn
              nghe từ bạn!
            </p>
            <div style={styles.featureList}>
              {[
                {
                  icon: "📧",
                  title: "Email",
                  text: "support@aura-dating.com",
                },
                {
                  icon: "💬",
                  title: "Hỗ Trợ Trong App",
                  text: "Nhắn tin trực tiếp qua ứng dụng",
                },
                {
                  icon: "🌐",
                  title: "Website",
                  text: "www.aura-dating.com",
                },
              ].map((contact, i) => (
                <div key={i} style={styles.featureItem}>
                  <div style={styles.featureIcon}>{contact.icon}</div>
                  <div style={styles.featureContent}>
                    <div style={styles.featureTitle}>{contact.title}</div>
                    <div style={styles.featureDesc}>{contact.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <button
              style={styles.ctaButton}
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
              Gửi Email Cho Chúng Tôi
            </button>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: 96,
            paddingTop: 32,
            borderTop: "1px solid #E8E5E0",
            textAlign: "center",
            color: "#6B6B6B",
            fontSize: 14,
          }}
        >
          <p>
            © 2024 Aura. Được xây dựng với ❤️ cho những trái tim tìm kiếm yêu
            thương.
          </p>
          <p style={{ marginTop: 8 }}>
            <a href="#" style={{ color: "#C94C5E", textDecoration: "none" }}>
              Chính Sách Bảo Mật
            </a>
            {" • "}
            <a href="#" style={{ color: "#C94C5E", textDecoration: "none" }}>
              Điều Khoản Dịch Vụ
            </a>
            {" • "}
            <a href="#" style={{ color: "#C94C5E", textDecoration: "none" }}>
              Hướng Dẫn Cộng Đồng
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
