import { GoogleGenAI, Modality } from "@google/genai";

// Ensure API key is present
const API_KEY = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateSpeech = async (
  text: string,
  voiceName: string,
  systemInstruction?: string
): Promise<string | undefined> => {
  if (!API_KEY) {
    throw new Error("API Key is missing. Please configure process.env.API_KEY.");
  }

  try {
    // The gemini-2.5-flash-preview-tts model handles instructions best when embedded in the prompt
    // rather than using the separate systemInstruction configuration field which can cause 500 errors.
    let promptText = text;
    if (systemInstruction && systemInstruction.trim()) {
      promptText = `${systemInstruction}\n\n${text}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: promptText }] }],
      config: {
        // systemInstruction removed from config to avoid 500 errors
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    // Extract base64 audio data
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
      throw new Error("No audio data returned from the model.");
    }

    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};