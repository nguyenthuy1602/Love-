import { useEffect, useRef } from 'react';
import { WS_BASE } from './api';

export function useNotifications(user, onNotification) {
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!user) return; // chỉ kết nối khi đã đăng nhập

    let active = true;

    const connect = () => {
      if (!active) return;
      const ws = new WebSocket(`${WS_BASE}/chat/notifications`);
      wsRef.current = ws;

      ws.onopen = () => {
        timerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping');
        }, 25000);
      };

      ws.onmessage = (e) => {
        if (e.data === 'pong') return;
        try { onNotification(JSON.parse(e.data)); } catch {}
      };

      ws.onclose = () => {
        clearInterval(timerRef.current);
        if (active) setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      active = false;
      clearInterval(timerRef.current);
      wsRef.current?.close();
    };
  }, [user?.id]); // re-connect khi user thay đổi
}
