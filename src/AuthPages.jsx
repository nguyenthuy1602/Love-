import { useState } from "react";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--rose), var(--rose-light))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 28,
          boxShadow: "0 8px 32px rgba(232,54,74,0.3)",
        }}
      >
        ❤️
      </div>
      <h1 style={{ fontSize: 36, color: "var(--rose)", marginBottom: 4 }}>
        Tình Yêu
      </h1>
      <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
        Kết nối những trái tim đồng điệu
      </p>
    </div>
  );
}

export function LoginPage({ onSwitch }) {
  const { login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      toast("Chào mừng trở lại! 💕", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Logo />
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <label className="label">Tên đăng nhập</label>
          <input
            className="input-field"
            placeholder="username của bạn"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Mật khẩu</label>
          <input
            className="input-field"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            required
          />
        </div>
        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          {loading ? (
            <span className="spinner" style={{ width: 18, height: 18 }} />
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: "var(--ink-soft)",
        }}
      >
        Chưa có tài khoản?{" "}
        <button
          onClick={onSwitch}
          style={{
            color: "var(--rose)",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Đăng ký ngay
        </button>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage({ onSwitch }) {
  const { register } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    bio: "",
    age: "",
    gender: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(
        // Thêm dấu /
        form.username,
        form.password,
        form.bio,
        form.age,
        form.gender,
      );
      toast("Tài khoản đã được tạo! Chào mừng bạn 🎉", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <Logo />
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <div>
          <label className="label">Tên đăng nhập</label>
          <input
            className="input-field"
            placeholder="chọn username độc đáo"
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label">Mật khẩu</label>
          <input
            className="input-field"
            type="password"
            placeholder="ít nhất 6 ký tự"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            required
            minLength={6}
          />
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label className="label">Tuổi</label>
            <input
              className="input-field"
              type="number"
              placeholder="VD: 20"
              value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="label">Giới tính</label>
            <select
              className="input-field"
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({ ...f, gender: e.target.value }))
              }
              required
              style={{ height: "42px" }}
            >
              <option value="">Chọn...</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">
            Giới thiệu bản thân{" "}
            <span style={{ color: "var(--ink-ghost)" }}>(tuỳ chọn)</span>
          </label>
          <textarea
            className="input-field"
            placeholder="Bạn là người như thế nào? Sở thích của bạn là gì?..."
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={3}
          />
        </div>
        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          {loading ? (
            <span className="spinner" style={{ width: 18, height: 18 }} />
          ) : (
            "✨ Tạo tài khoản"
          )}
        </button>
      </form>
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: "var(--ink-soft)",
        }}
      >
        Đã có tài khoản?{" "}
        <button
          onClick={onSwitch}
          style={{
            color: "var(--rose)",
            fontWeight: 600,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Đăng nhập
        </button>
      </p>
    </AuthLayout>
  );
}

function AuthLayout({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "linear-gradient(135deg, var(--cream) 0%, #fff5f7 50%, var(--rose-pale) 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* decorative */}
      <div
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(232,54,74,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,164,89,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          padding: "40px 40px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)",
          animation: "fadeUp 0.4s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
