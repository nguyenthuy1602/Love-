export function AvatarImg({ src, name = '?', size = 40, style = {} }) {
  const letter = (name || '?')[0].toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0, ...style }}
      />
    );
  }
  const fontSize = size * 0.38;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--rose-pale), var(--blush))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--rose)', fontWeight: 700, fontSize,
      fontFamily: "'Playfair Display', serif",
      flexShrink: 0, ...style
    }}>{letter}</div>
  );
}
