/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { IdiomInfo, RelatedIdiomsResponse, CrossLanguageIdioms, Language } from '../types';

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
    contents: `Explain the idiom "${idiom}" in ${language}. Provide its meaning, a brief history or origin, and at least five distinct example sentences.`,
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
          examples: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: `An array of at least five example sentences using the idiom "${idiom}".`,
          },
        },
        required: ['meaning', 'history', 'examples'],
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

export async function getRelatedIdioms(
  idiom: string,
  language: string,
): Promise<string[]> {
  const ai = getAi();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find idioms that are related to or have a similar meaning to "${idiom}" in the ${language} language. Provide a list of 5 such idioms.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          related_idioms: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: `An array of 5 idioms related to "${idiom}".`,
          },
        },
        required: ['related_idioms'],
      },
    },
  });

  const jsonText = response.text.trim();
  const parsed: RelatedIdiomsResponse = JSON.parse(jsonText);
  return parsed.related_idioms;
}

export async function getCrossLanguageIdioms(
  idiom: string,
  sourceLanguage: Language,
  allLanguages: Language[],
): Promise<CrossLanguageIdioms> {
  const ai = getAi();
  const targetLanguages = allLanguages.filter(lang => lang !== sourceLanguage);
  
  if (targetLanguages.length === 0) {
    return {};
  }

  const schemaProperties = targetLanguages.reduce((acc, lang) => {
    acc[lang] = {
      type: Type.STRING,
      description: `The closest equivalent idiom in ${lang}. If no direct equivalent exists, provide a short phrase that captures the same meaning.`,
    };
    return acc;
  }, {} as Record<string, { type: Type, description: string }>);


  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `For the ${sourceLanguage} idiom "${idiom}", find the closest equivalent or a similar-meaning idiom in each of the following languages: ${targetLanguages.join(', ')}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: schemaProperties,
      },
    },
  });
  
  const jsonText = response.text.trim();
  return JSON.parse(jsonText);
}