import { GoogleGenAI, Type } from '@google/genai';
import { GeminiAnalysisResult } from '../types';

// Fallback data for when API quota is exceeded or fails
const FALLBACK_ANALYSIS: GeminiAnalysisResult = {
  title: "SIMULATION: QUANTUM FLUX",
  energyLevel: "UNKNOWN (LIMIT REACHED)",
  description: "External sensor connection unstable (API Quota Exceeded). Running local probabilistic simulation based on thermal heuristics. Subject appears to be in a state of high coherence.",
  elements: [
    "Simulated Core Stability",
    "Heuristic Heat Flow",
    "Fallback Protocol Active"
  ]
};

export const analyzeThermalImage = async (base64Image: string): Promise<GeminiAnalysisResult> => {
  if (!process.env.API_KEY) {
    console.warn("API Key missing, using fallback.");
    return FALLBACK_ANALYSIS;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Clean base64 string
  const data = base64Image.replace(/^data:image\/(png|jpeg);base64,/, "");

  const prompt = `
    Analyze this pseudo-thermal image. The image uses a color scale where Blue/Black is cold (background) and Red/White is hot (human subject energy).
    Treat this as a Sci-Fi "Bio-Etheric Energy Scan".
    
    Provide a structured output describing:
    1. A short, cool sci-fi title for the detected posture/state (e.g., "Hyper-Focus State", "Resting Potential").
    2. An estimated "Energy Level" (percentage or descriptive).
    3. A brief creative description of the "thermal flow" or "energy signature" seen in the image.
    4. A list of 3 key elements detected (e.g., "High cerebral activity", "Stable core temperature").
    
    Keep it immersive and futuristic.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: data
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            energyLevel: { type: Type.STRING },
            description: { type: Type.STRING },
            elements: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    
    return JSON.parse(text) as GeminiAnalysisResult;
  } catch (error: any) {
    console.error("Gemini Analysis Failed:", error);
    
    // Check for quota exhaustion or other API errors
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('429')) {
        console.warn("Quota exceeded. Switching to simulation mode.");
        return FALLBACK_ANALYSIS;
    }
    
    // For other errors, we can also return fallback to keep app alive, 
    // or rethrow if you want the UI to show a specific error.
    // Returning fallback for smoother UX:
    return {
        ...FALLBACK_ANALYSIS,
        title: "SCAN ERROR: OFFLINE",
        description: "Unable to reach neural network. " + (error.message || "Unknown error occurred.")
    };
  }
};