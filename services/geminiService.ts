/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { IdiomInfo } from '../types';

let ai: GoogleGenAI;

function getAi() {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
}

export async function getIdiomInfo(
  idiom: string,
  language: string,
): Promise<IdiomInfo> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Explain the idiom "${idiom}" in ${language}. Provide its meaning, a brief history or origin, and an example sentence.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meaning: {
            type: Type.STRING,
            description: `The literal meaning of the idiom "${idiom}".`,
          },
          history: {
            type: Type.STRING,
            description: `The history or origin of the idiom "${idiom}".`,
          },
          example: {
            type: Type.STRING,
            description: `An example sentence using the idiom "${idiom}".`,
          },
        },
        required: ['meaning', 'history', 'example'],
      },
    },
  });
  
  const jsonText = response.text.trim();
  return JSON.parse(jsonText);
}

export async function getTextToSpeech(text: string): Promise<string> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, // A versatile voice
        },
      },
    },
  });
  
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!base64Audio) {
    throw new Error('No audio data received from API.');
  }
  
  return base64Audio;
}
