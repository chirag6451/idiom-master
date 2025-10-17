/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum VeoModel {
  VEO = 'veo-3.1-generate-preview',
  VEO_FAST = 'veo-3.1-fast-generate-preview',
}

export enum AspectRatio {
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
}

export enum Resolution {
  P720 = '720p',
  P1080 = '1080p',
}

export enum GenerationMode {
  TEXT_TO_VIDEO = 'Text to Video',
  FRAMES_TO_VIDEO = 'Frames to Video',
  REFERENCES_TO_VIDEO = 'References to Video',
}

export interface ImageFile {
  file: File;
  base64: string;
}

export interface VideoFile {
  file: File;
  base64: string;
}

export interface GenerateVideoParams {
  prompt: string;
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  mode: GenerationMode;
  startFrame: ImageFile | null;
  endFrame: ImageFile | null;
  referenceImages: ImageFile[];
  styleImage: ImageFile | null;
  inputVideo: VideoFile | null;
  isLooping: boolean;
}

export type Language = string;

export interface ItemInfo {
    item: string;
    meaning: string;
    history: string;
    examples: string[];
}

export type LearningMode = 'idioms' | 'words';

export interface Favorite {
    key: string;
    phrase: string;
    language: Language;
    type: LearningMode;
}

export type ViewMode = 'All' | 'Favorites';

export interface SearchResult {
    phrase: string;
    language: Language;
    type: LearningMode;
}

export type CrossLanguageIdioms = Record<Language, string>;