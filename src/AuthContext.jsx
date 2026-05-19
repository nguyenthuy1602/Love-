import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await api.get("/api/auth/me/"); // Thêm dấu /
      setUser(data.user || data);
    } catch (err) {
      console.warn("Auth check failed:", err.message);
      if (err.status === 401) {
        localStorage.removeItem("token"); // Xóa token nếu nhận 401 Unauthorized
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username, password) => {
    const data = await api.post("/api/auth/login/", { username, password });

    // Lấy token từ response (access_token là chuẩn của FastAPI OAuth2)
    const token = data.access_token || data.token;
    if (token) {
      localStorage.setItem("token", token);

      // Lấy thông tin user đầy đủ từ response hoặc gọi API me
      const me = await api.get("/api/auth/me/"); // Thêm dấu /
      const userData = me.user || me;
      setUser(userData);
      return userData;
    }
    throw new Error("Không nhận được token từ máy chủ");
  };

  const register = async (username, password, bio, age, gender) => {
    const payload = { username, password, bio };
    if (age) payload.age = parseInt(age);
    if (gender) payload.gender = gender;

    const data = await api.post("/api/auth/register/", payload); // Thêm dấu /

    const token = data.access_token || data.token;
    if (token) {
      localStorage.setItem("token", token);
      const me = await api.get("/api/auth/me");
      const userData = me.user || me;
      setUser(userData);
      return userData;
    }
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/api/auth/logout/"); // Thêm dấu /
    } finally {
      localStorage.removeItem("token");
      setUser(null);
    }
  };

  const updateUser = (updates) => setUser((u) => ({ ...u, ...updates }));

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateUser,
        refetch: fetchMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn("useAuth must be used within an AuthProvider");
    return {
      user: null,
      loading: false, // Tránh kẹt màn hình loading nếu thiếu Provider
      login: () => {},
      register: () => {},
      logout: () => {},
      updateUser: () => {},
      refetch: () => {},
    };
  }
  return context;
};
