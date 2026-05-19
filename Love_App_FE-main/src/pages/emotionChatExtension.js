/**
 * Wrapper extension for chat messages to support future emotion metadata
 */
export const wrapChatMessage = (text) => {
  // Return the expected object structure for the existing WebSocket logic
  return { content: text.trim() };
};
