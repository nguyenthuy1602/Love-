import { BASE_URL } from "../api";

const resolveMediaUrl = (url) => {
  if (!url) return url;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  // Backend thường trả về /static/... hoặc /media/...
  return `${cleanBase}${url.startsWith("/") ? url : "/" + url}`;
};

export function AvatarImg({ src, name = "?", size = 40, style = {} }) {
  const letter = (name || "?")[0].toUpperCase();
  if (src) {
    return (
      <img
        src={resolveMediaUrl(src)} // Sử dụng resolveMediaUrl
        alt={name}
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }
  const fontSize = size * 0.38;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--rose-pale), var(--blush))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--rose)",
        fontWeight: 700,
        fontSize,
        fontFamily: "'Playfair Display', serif",
        flexShrink: 0,
        ...style,
      }}
    >
      {letter}
    </div>
  );
}
