/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum AppState {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR,
}

export interface IdiomInfo {
  meaning: string;
  history: string;
  examples: string[];
}

export type Language = string;

export type Favorite = {
  idiom: string;
  language: Language;
  info: IdiomInfo; // Store full idiom info for offline access
  savedAt: number; // Timestamp when saved
};

export enum ViewMode {
  ALL,
  FAVORITES,
}

export interface RelatedIdiomsResponse {
  related_idioms: string[];
}

export type CrossLanguageIdioms = Partial<Record<Language, string>>;

export interface SearchResult {
  idiom: string;
  language: Language;
}


// FIX: Add missing types for video generation feature.
export enum VeoModel {
  VEO_FAST = 'veo-3.1-fast-generate-preview',
  VEO = 'veo-3.1-generate-preview',
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

export interface VideoFile extends ImageFile {}

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