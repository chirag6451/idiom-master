/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { IdiomInfo, RelatedIdiomsResponse, CrossLanguageIdioms, Language, SearchResult } from '../types';

let ai: GoogleGenAI;

function getAi() {
  if (!ai) {
    // Check for API key in environment variables
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
    
    if (!apiKey) {
      throw new Error('API_KEY is not configured. Please set VITE_GEMINI_API_KEY in your environment.');
    }
    
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export async function getIdiomInfo(
  idiom: string,
  language: string,
): Promise<IdiomInfo> {
  try {
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
    
    if (!response || !response.text) {
      throw new Error('No response received from AI service');
    }
    
    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    
    // Validate the response has required fields
    if (!parsed.meaning || !parsed.history || !parsed.examples) {
      throw new Error('Incomplete idiom information received');
    }
    
    return parsed;
  } catch (error: any) {
    console.error('Error in getIdiomInfo:', error);
    
    // Provide more specific error messages
    if (error.message?.includes('API_KEY')) {
      throw new Error('API key is missing or invalid. Please check your configuration.');
    } else if (error.message?.includes('quota')) {
      throw new Error('API quota exceeded. Please try again later.');
    } else if (error.message?.includes('rate limit')) {
      throw new Error('Too many requests. Please wait a moment and try again.');
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      throw new Error('Network error. Please check your internet connection.');
    } else if (error instanceof SyntaxError) {
      throw new Error('Failed to parse AI response. The idiom might not be recognized.');
    } else {
      throw new Error(`Could not fetch idiom information: ${error.message || 'Unknown error'}`);
    }
  }
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

export async function performIdiomSearch(
  query: string,
  validLanguages: Language[]
): Promise<SearchResult[]> {
  const ai = getAi();

  const prompt = `
    A user is searching for an idiom using the query: "${query}".
    The query might be an exact idiom, a partial idiom, contain spelling mistakes, or be a description of an idiom.

    Your task is to act as an expert linguist. Based on the user's query, identify the most likely idiom they are looking for.
    Then, find up to 4 other highly relevant idioms. The idioms can be from any of these languages: ${validLanguages.join(', ')}.

    Return a JSON object containing an array of up to 5 search results in the "matches" property.
    Each result must be an object with the full, correct idiom text and its language.
    The most likely match should be the first element in the array.
    If the user's query is a perfect match for a known idiom (e.g., "a walk in the park"), that idiom should be the first result.
    If no relevant idioms can be found, return an empty array in the "matches" property.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matches: {
            type: Type.ARRAY,
            description: "An array of matching idioms.",
            items: {
              type: Type.OBJECT,
              properties: {
                idiom: {
                  type: Type.STRING,
                  description: "The full text of the matching idiom."
                },
                language: {
                  type: Type.STRING,
                  description: `The language of the idiom (must be one of '${validLanguages.join("', '")}').`
                }
              },
              required: ['idiom', 'language']
            }
          }
        },
        required: ['matches']
      }
    }
  });

  const jsonText = response.text.trim();
  const parsedResponse = JSON.parse(jsonText);
  
  // Ensure we only return results with languages supported by the app
  const filteredMatches = (parsedResponse.matches || []).filter(
      (match: any): match is SearchResult => 
          typeof match.idiom === 'string' &&
          typeof match.language === 'string' &&
          validLanguages.includes(match.language as Language)
  );
  return filteredMatches;
}