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
  example: string;
}

export type Language = 'English' | 'Hindi' | 'Gujarati';

export type Favorite = {
  idiom: string;
  language: Language;
};

export enum ViewMode {
  ALL,
  FAVORITES,
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
