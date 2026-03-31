import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const getDonationAdvice = async (question: string): Promise<string> => {
  if (!apiKey) return "দুঃখিত, এআই সেবা বর্তমানে উপলব্ধ নয়।";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: question,
      config: {
        systemInstruction: "You are a helpful medical assistant for 'Shishir Voluntary Organization' in Bangladesh. You speak Bengali. Your goal is to encourage blood donation and answer eligibility questions (e.g., can I donate if I smoke, weight limits, age limits). Keep answers concise and warm. Always respond in Bengali.",
      },
    });
    
    return response.text || "দুঃখিত, আমি বুঝতে পারিনি।";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "বর্তমানে সংযোগে সমস্যা হচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
  }
};
