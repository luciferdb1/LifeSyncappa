import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getDonationAdvice = async (question: string): Promise<string> => {
  if (!apiKey) return "Sorry, AI service is currently unavailable.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: question,
      config: {
        systemInstruction: "You are a helpful medical assistant for 'Shishir Voluntary Organization'. Your goal is to encourage blood donation and answer eligibility questions (e.g., can I donate if I smoke, weight limits, age limits). Keep answers concise and warm. Always respond in English.",
      },
    });
    
    return response.text || "Sorry, I didn't understand that.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Connection issue. Please try again later.";
  }
};
