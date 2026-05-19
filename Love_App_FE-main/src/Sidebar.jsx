import { useAuth } from "./AuthContext";
import { AvatarImg } from "./components/AvatarImg";

const NAV = [
  { key: "feed", icon: "🏠", label: "Trang chủ" },
  { key: "match", icon: "💘", label: "Love You" },
  { key: "messages", icon: "💬", label: "Tin nhắn" },
  { key: "profile", icon: "👤", label: "Hồ sơ" },
];

export function Sidebar({ page, setPage, notifCount }) {
  const { user, logout } = useAuth();

  return (
    <aside
      style={{
        width: 72,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0",
        gap: 8,
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        onClick={() => setPage("feed")}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--rose), var(--rose-light))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          cursor: "pointer",
          marginBottom: 12,
          boxShadow: "0 4px 12px rgba(232,54,74,0.25)",
          transition: "transform 0.2s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        ❤️
      </div>

      {NAV.map((n) => (
        <NavBtn
          key={n.key}
          icon={n.icon}
          label={n.label}
          active={page === n.key}
          badge={n.key === "messages" ? notifCount : 0}
          onClick={() => setPage(n.key)}
        />
      ))}

      <div style={{ flex: 1 }} />

      {/* About button */}
      <NavBtn icon="ℹ️" label="Về ứng dụng" onClick={() => setPage("about")} />

      {/* User avatar */}
      <button
        onClick={() => setPage("profile")}
        style={{
          padding: 4,
          border:
            page === "profile"
              ? "2px solid var(--rose)"
              : "2px solid transparent",
          borderRadius: "50%",
          background: "none",
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
      >
        <AvatarImg src={user?.avatar_url} name={user?.username} size={36} />
      </button>

      <NavBtn icon="🚪" label="Đăng xuất" onClick={logout} danger />
    </aside>
  );
}

function NavBtn({ icon, label, active, onClick, badge, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 48,
        height: 48,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 20,
        position: "relative",
        background: active ? "var(--rose-pale)" : "transparent",
        color: active ? "var(--rose)" : danger ? "#e11d48" : "var(--ink-soft)",
        transition: "all 0.2s",
        border: active ? "1.5px solid var(--blush)" : "1.5px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--rose-pale)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {icon}
      {badge > 0 && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "var(--rose)",
            color: "#fff",
            borderRadius: "50%",
            width: 16,
            height: 16,
            fontSize: 9,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
