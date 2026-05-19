import { api } from "../api";

export const emotionMatchApi = {
  getEmotionRandomSuggestion: () => api.get("/api/match/emotion-random"),
  getEmotionSuggestion: () => api.get("/api/match/suggest"),
};
