/**
 * Adapter để chuẩn hóa dữ liệu từ API match/emotion-random.
 * Đảm bảo kết quả trả về luôn là một mảng để tránh lỗi UI.
 */
export const normalizeEmotionMatch = (response) => {
  // Bước 3: In ra console để kiểm tra request thực tế
  const data = response?.data !== undefined ? response.data : response;
  console.log("MATCH RESPONSE:", data);

  // Bước 4 & 5: Kiểm tra và trả về mảng dựa trên cấu trúc backend
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.matches)) return data.matches;
  if (data && Array.isArray(data.data)) return data.data;

  return [];
};
