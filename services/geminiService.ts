/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ItemInfo, Language, LearningMode, SearchResult, CrossLanguageIdioms } from '../types';

// Per guidelines, initialize with API_KEY from environment variables.
// Assuming process.env.API_KEY is available.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * A helper function to inspect API errors and return a user-friendly message
 * for rate limit issues.
 * @param error The error object caught from the API call.
 * @param defaultMessage A default message for other types of errors.
 * @returns An Error object with an appropriate message.
 */
const handleApiError = (error: any, defaultMessage: string): Error => {
    const errorString = JSON.stringify(error);
    if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
        return new Error('You have exceeded your API request quota. Please wait a minute and try again.');
    }
    console.error(defaultMessage, error);
    return new Error(defaultMessage);
};


export const getItemInfo = async (phrase: string, lang: Language, type: LearningMode): Promise<ItemInfo> => {
    let prompt: string;
    let historyFieldDescription: string;

    if (type === 'words') {
        prompt = `Analyze the uncommon professional word "${phrase}" in ${lang}. Provide its precise meaning, its detailed etymology (origin), and at least five distinct example sentences showcasing its use in a professional or formal context.`;
        historyFieldDescription = 'The etymology or origin of the word.';
    } else { // idioms
        prompt = `Analyze the idiom "${phrase}" in ${lang}. Provide its literal and figurative meaning, its detailed history (origin), and at least five distinct example sentences.`;
        historyFieldDescription = 'The history or origin of the idiom.';
    }

    const itemInfoSchema = {
        type: Type.OBJECT,
        properties: {
            item: { type: Type.STRING, description: `The ${type.slice(0, -1)} itself.` },
            meaning: { type: Type.STRING, description: `The meaning of the ${type.slice(0, -1)}.` },
            history: { type: Type.STRING, description: historyFieldDescription },
            examples: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: `A list of at least 5 sentences using the ${type.slice(0, -1)}.`
            },
        },
        required: ['item', 'meaning', 'history', 'examples'],
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: itemInfoSchema,
            },
        });

        const jsonStr = response.text.trim();
        const info = JSON.parse(jsonStr) as ItemInfo;
        return info;
    } catch (error) {
        throw handleApiError(error, `Failed to get details for "${phrase}". The model response might be malformed.`);
    }
};

const relatedItemsSchema = {
    type: Type.OBJECT,
    properties: {
        related_items: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'A list of related idioms or words.'
        },
    },
    required: ['related_items'],
};

export const getRelatedItems = async (phrase: string, lang: Language, type: LearningMode): Promise<string[]> => {
    let prompt: string;
    if (type === 'words') {
        prompt = `List up to 5 uncommon, professional words in ${lang} that are thematically or contextually similar to the word "${phrase}".`;
    } else { // idioms
        prompt = `List up to 5 idioms in ${lang} that are thematically or metaphorically similar to the idiom "${phrase}".`;
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: relatedItemsSchema,
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        return result.related_items || [];
    } catch (error) {
        throw handleApiError(error, `Failed to get related ${type}. The model response might be malformed.`);
    }
};

export const getTextToSpeech = async (text: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' }, // A standard voice
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("Failed to generate audio: no audio data received.");
        }
        return base64Audio;
    } catch (error) {
        throw handleApiError(error, 'Failed to generate audio.');
    }
};

const searchResultSchema = {
    type: Type.OBJECT,
    properties: {
        results: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    phrase: { type: Type.STRING },
                    language: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['idioms', 'words'] },
                },
                required: ['phrase', 'language', 'type'],
            },
        },
    },
    required: ['results'],
};

export const performIdiomSearch = async (query: string, languages: Language[], type: LearningMode): Promise<SearchResult[]> => {
    const prompt = `Find ${type} that match the search query "${query}". Search within the languages: ${languages.join(', ')}. The query might have typos or be a semantic description. Return a list of matching phrases, each with its language and type ('idioms' or 'words').`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: searchResultSchema,
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        // Filter results to only include the requested type, as model might return both
        return (result.results || []).filter((r: SearchResult) => r.type === type);
    } catch (error) {
        throw handleApiError(error, 'Search failed. The model response might be malformed.');
    }
};


export const getCrossLanguageIdioms = async (phrase: string, sourceLang: Language, targetLangs: Language[], type: LearningMode): Promise<CrossLanguageIdioms> => {
    const otherLangs = targetLangs.filter(l => l !== sourceLang);
    if (otherLangs.length === 0) {
        return {};
    }

    const properties: Record<string, { type: Type; description: string }> = {};
    otherLangs.forEach(lang => {
        properties[lang] = {
            type: Type.STRING,
            description: `The equivalent ${type.slice(0, -1)} for "${phrase}" in ${lang}. If no direct equivalent exists, provide the closest one.`
        };
    });

    const crossLanguageSchema = {
        type: Type.OBJECT,
        properties: properties,
    };

    const prompt = `For the ${sourceLang} ${type.slice(0, -1)} "${phrase}", find the equivalent or closest ${type.slice(0, -1)} in each of the following languages: ${otherLangs.join(', ')}. Provide only one result per language.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: crossLanguageSchema,
            },
        });

        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr) as CrossLanguageIdioms;
        return result;
    } catch (error) {
        throw handleApiError(error, 'Failed to get cross-language equivalents.');
    }
};