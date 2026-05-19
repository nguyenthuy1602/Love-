import axios from "axios";

const IS_DEV = true; // Luôn ưu tiên 127.0.0.1 ở môi trường local

export const BASE_URL = IS_DEV
  ? "http://127.0.0.1:8000"
  : "https://love-app-igja.onrender.com";
export const WS_BASE = IS_DEV
  ? "ws://127.0.0.1:8000"
  : "wss://love-app-igja.onrender.com";

// Cấu hình Axios Instance
const instance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Quan trọng: Gửi/nhận session cookies
});

// Interceptor gắn JWT Token
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor xử lý response và lỗi
instance.interceptors.response.use(
  (response) => {
    if (IS_DEV) {
      console.info(
        `[api:res] ${response.config.method.toUpperCase()} ${response.config.url}`,
        response.data,
      );
    }
    return response.data;
  },
  (error) => {
    const data = error.response?.data;
    let errorMsg = "Lỗi không xác định";

    if (data) {
      errorMsg = data.detail || data.message || JSON.stringify(data);
      if (Array.isArray(data.detail))
        errorMsg = data.detail[0]?.msg || errorMsg;
      console.log("[api:debug_response_data]", data);
    }

    if (IS_DEV && error.response?.status !== 401) {
      console.error("[api:error]", errorMsg);
    }

    const err = new Error(String(errorMsg));
    err.status = error.response?.status;
    err.response = error.response;
    throw err;
  },
);

export const api = {
  get: (path) => instance.get(path),
  post: (path, body) => instance.post(path, body),
  patch: (path, body) => instance.patch(path, body),
  delete: (path) => instance.delete(path),
  postForm: (path, formData) =>
    instance.post(path, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
};
