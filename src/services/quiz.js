// src/services/quiz.js
import api from "./api";
import { postGamificationSync } from "./gamificationStorage";

/** Backend'e quiz sonuçlarını gönderir */
export async function submitQuiz(payload) {
  // payload: { items:[{soruId, secenekId}], startedAt, finishedAt }
  const { data } = await api.post("/api/quiz/submit", payload);
  postGamificationSync().catch(() => {});
  return data; // { oturumId, correct, wrong, total, score }
}
