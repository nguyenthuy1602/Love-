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
    try {
      const data = await api.get("/api/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (username, password) => {
    const data = await api.post("/api/auth/login", { username, password });
    // Giả định backend trả về JWT trong trường 'access_token' hoặc 'token'
    if (data.access_token) {
      localStorage.setItem("jwt_token", data.access_token);
    } else if (data.token) {
      localStorage.setItem("jwt_token", data.token);
    }
    setUser(data.user);
    return data.user;
  };

  const register = async (username, password, bio, age, gender) => {
    const payload = { username, password, bio };
    if (age) payload.age = parseInt(age);
    if (gender) payload.gender = gender;
    const data = await api.post("/api/auth/register", payload);
    // Giả định backend trả về JWT trong trường 'access_token' hoặc 'token'
    if (data.access_token) {
      localStorage.setItem("jwt_token", data.access_token);
    } else if (data.token) {
      localStorage.setItem("jwt_token", data.token);
    }
    setUser(data);
    return data;
  };

  const logout = async () => {
    await api.post("/api/auth/logout");
    localStorage.removeItem("jwt_token"); // Xóa token khi đăng xuất
    setUser(null);
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

export const useAuth = () => useContext(AuthContext);
