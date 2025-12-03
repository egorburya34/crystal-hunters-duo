import { GoogleGenAI, Type } from "@google/genai";
import { LevelInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateLevelInfo = async (level: number): Promise<LevelInfo> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a creative, sci-fi/fantasy rogue-like game level description for Level ${level}. 
      The setting is a dangerous alien planet. 
      Include a biome name, a short atmospheric description, a scary boss name, and a one-sentence description of the boss.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            biomeName: { type: Type.STRING },
            description: { type: Type.STRING },
            bossName: { type: Type.STRING },
            bossDescription: { type: Type.STRING },
          },
          required: ["biomeName", "description", "bossName", "bossDescription"],
        },
      },
    });

    const data = JSON.parse(response.text || "{}");
    
    return {
      levelNumber: level,
      biomeName: data.biomeName || `Sector ${level}`,
      description: data.description || "A desolate wasteland filled with unknown threats.",
      bossName: data.bossName || "The Guardian",
      bossDescription: data.bossDescription || "A massive construct of ancient metal.",
    };
  } catch (error) {
    console.error("Gemini generation failed", error);
    return {
      levelNumber: level,
      biomeName: `Sector ${level}-Z`,
      description: "Communications offline. Terrain data unavailable. Proceed with caution.",
      bossName: "Omega Construct",
      bossDescription: "An unidentifiable massive energy signature detected.",
    };
  }
};