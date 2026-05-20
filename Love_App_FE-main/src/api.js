const IS_DEV = Boolean(import.meta?.env?.DEV);
export const BASE_URL = IS_DEV
  ? "http://127.0.0.1:8000"
  : "https://love-app-igja.onrender.com";
export const WS_BASE = IS_DEV
  ? "ws://127.0.0.1:8000"
  : "wss://love-app-igja.onrender.com";

const req = (method, path, body, isForm = false) => {
  // Đảm bảo URL luôn chính xác, không bị dính chữ hoặc thừa dấu /
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const url = `${BASE_URL.replace(/\/$/, "")}${safePath}`;

  const opts = { method, credentials: "include" };
  if (body !== undefined && body !== null && !isForm) {
    opts.headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    opts.body = JSON.stringify(body);
  } else if (body && isForm) {
    opts.body = body;
  }

  if (IS_DEV) {
    console.info("[api:req]", {
      method,
      path,
      body, // Log body để kiểm tra payload thực tế gửi lên /match/like
      contentType: isForm ? "multipart/form-data" : "application/json",
    });
  }

  return fetch(url, opts).then(async (r) => {
    if (r.status === 204) return null;
    const data = await r.json().catch(() => ({}));

    if (IS_DEV) {
      console.info("[api:res]", {
        method,
        path,
        status: r.status,
        body: data,
      });
    }

    if (!r.ok) {
      let errorMsg = "Lỗi không xác định";

      if (typeof data === "object" && data !== null) {
        errorMsg = data.detail || data.message || JSON.stringify(data);
        // Xử lý lỗi 422 của FastAPI: detail thường là mảng các lỗi validation
        if (Array.isArray(data.detail)) {
          errorMsg = data.detail
            .map((e) => `${e.loc.join(".")}: ${e.msg}`)
            .join(", ");
        } else {
          errorMsg = data.detail || data.message || JSON.stringify(data);
        }
      } else if (typeof data === "string") {
        errorMsg = data;
      }

      if (IS_DEV) {
        console.error("[api:error]", {
          method,
          path,
          status: r.status,
          errorMsg,
          fullData: data,
        });
      }

      const err = new Error(errorMsg);
      err.status = r.status;
      err.body = data;
      err.path = path;
      throw err;
    }
    return data;
  });
};

export const api = {
  get: (path) => req("GET", path),
  post: (path, body) => req("POST", path, body),
  patch: (path, body) => req("PATCH", path, body),
  delete: (path) => req("DELETE", path),
  postForm: (path, formData) => req("POST", path, formData, true),
};
