/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, IdiomInfo, Language, Favorite, ViewMode, CrossLanguageIdioms, SearchResult } from './types';
import { getIdiomInfo, getTextToSpeech, getRelatedIdioms, getCrossLanguageIdioms, performIdiomSearch } from './services/geminiService';
import { ArrowPathIcon, SpeakerWaveIcon, StopIcon, MagnifyingGlassIcon, StarIcon, ArrowDownTrayIcon, XMarkIcon, SparklesIcon, ArrowUturnLeftIcon } from './components/icons';
import { Login } from './components/Login';
import { getCurrentUser, saveCurrentUser, logout, User } from './services/authService';
import { fetchUserFavorites, saveFavoriteToBackend, deleteFavoriteFromBackend, checkBackendHealth } from './services/favoritesApi';

// --- Types for Config ---
type LanguageConfig = {
  idioms: string[];
};
type AppConfig = {
  languages: Record<Language, LanguageConfig>;
};

// --- Audio Utilities ---
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// --- Main Component ---
const App: React.FC = () => {
  // Config state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [language, setLanguage] = useState<Language>('');
  const [currentIdiom, setCurrentIdiom] = useState<string | null>(null);
  const [idiomInfo, setIdiomInfo] = useState<IdiomInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Audio State
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  
  // Favorites State
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.ALL);
  const [currentFavoriteIndex, setCurrentFavoriteIndex] = useState(0);

  // Install Modal State
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // User authentication state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);

  // Related Idioms State
  const [isShowingRelated, setIsShowingRelated] = useState(false);
  const [relatedIdioms, setRelatedIdioms] = useState<string[] | null>(null);
  const [relatedError, setRelatedError] = useState<string | null>(null);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const originalIdiomRef = useRef<{ idiom: string; lang: Language } | null>(null);

  // Cross-Language State
  const [crossLanguageIdioms, setCrossLanguageIdioms] = useState<CrossLanguageIdioms | null>(null);
  const [isCrossLangLoading, setIsCrossLangLoading] = useState(false);

  // --- Effects ---
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/languages.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: AppConfig = await response.json();
        if (!data.languages || Object.keys(data.languages).length === 0) {
            throw new Error("Invalid or empty language configuration.");
        }
        setConfig(data);
        const initialLanguage = Object.keys(data.languages)[0] as Language;
        setLanguage(initialLanguage);
      } catch (e) {
        console.error("Failed to load languages.json:", e);
        setConfigError("Could not load language configuration. Please check the 'public/languages.json' file and refresh the page.");
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Check backend availability on startup
  useEffect(() => {
    const checkBackend = async () => {
      const available = await checkBackendHealth();
      setIsBackendAvailable(available);
      if (available) {
        console.log('✅ Backend API is available');
      } else {
        console.log('⚠️ Backend API not available, using local storage only');
      }
    };
    checkBackend();
  }, []);

  // Check for logged-in user on startup
  useEffect(() => {
    const loadUser = async () => {
      const user = getCurrentUser();
      if (user) {
        console.log('✅ User already logged in:', user.username);
        setCurrentUser(user);
        
        // Load favorites from backend if available
        if (isBackendAvailable) {
          try {
            const serverFavorites = await fetchUserFavorites(user.id);
            const convertedFavorites: Favorite[] = serverFavorites.map(fav => ({
              idiom: fav.idiom,
              language: fav.language as Language,
              info: {
                meaning: fav.meaning,
                history: fav.history,
                examples: fav.examples
              },
              audioData: fav.audio_url,
              savedAt: fav.saved_at
            }));
            setFavorites(convertedFavorites);
            console.log(`✅ Auto-loaded ${convertedFavorites.length} favorites from backend`);
          } catch (error) {
            console.error('❌ Failed to auto-load favorites:', error);
          }
        }
      } else {
        console.log('⚠️ No user logged in, showing login screen');
        setShowLogin(true);
      }
    };
    
    if (isBackendAvailable !== null) {
      loadUser();
    }
  }, [isBackendAvailable]);
  
  useEffect(() => {
    if (!currentUser) return; // Don't load favorites if not logged in
    
    try {
      // Use user-specific localStorage key
      const storageKey = `idiomFavorites_${currentUser.id}`;
      const storedFavorites = localStorage.getItem(storageKey);
      console.log(`Checking favorites for user ${currentUser.username}:`, storedFavorites?.substring(0, 100));
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites);
        console.log(`✅ Loaded ${parsed.length} favorites for ${currentUser.username}:`, parsed.map(f => f.idiom));
        setFavorites(parsed);
      } else {
        console.log(`⚠️ No favorites found for user ${currentUser.username}`);
      }
    } catch (error) {
      console.error("❌ Failed to load favorites from localStorage:", error);
    }
  }, [currentUser]);
  
  useEffect(() => {
      // Only fetch idiom if user is logged in
      if (config && !currentIdiom && currentUser) {
        fetchNewIdiom(language);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, language, currentUser]);


  useEffect(() => {
    if (!currentUser) return; // Don't save if not logged in
    
    if (favorites.length === 0) {
      console.log('⚠️ Favorites array is empty, not saving to localStorage');
      return;
    }
    
    try {
      // Use user-specific localStorage key
      const storageKey = `idiomFavorites_${currentUser.id}`;
      const favoritesData = JSON.stringify(favorites);
      localStorage.setItem(storageKey, favoritesData);
      
      // Log storage usage
      const sizeInBytes = new Blob([favoritesData]).size;
      const sizeInKB = (sizeInBytes / 1024).toFixed(2);
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      console.log(`💾 Saved ${favorites.length} favorites for ${currentUser.username}: ${sizeInKB} KB (${sizeInMB} MB)`);
      console.log('Favorites:', favorites.map(f => f.idiom));
      
      // Warn if approaching localStorage limit (typically 5-10MB)
      if (sizeInBytes > 4 * 1024 * 1024) { // 4MB warning
        console.warn('⚠️ Favorites storage is getting large. Consider removing old items.');
      }
    } catch (error: any) {
      console.error("❌ Failed to save favorites to localStorage:", error);
      if (error.name === 'QuotaExceededError') {
        setToastMessage('⚠️ Storage full! Remove some favorites to save new ones.');
      }
    }
  }, [favorites, currentUser]);
  
  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);


  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // Create AudioContext with proper mobile browser support
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ 
        sampleRate: 24000,
        latencyHint: 'interactive' // Better for mobile
      });
      console.log('AudioContext created, state:', audioContextRef.current.state);
    }
    return audioContextRef.current;
  }, []);

  const resetRelatedState = () => {
    setIsShowingRelated(false);
    setRelatedIdioms(null);
    setRelatedError(null);
    originalIdiomRef.current = null;
  }
  
  const handleLogin = async (user: User) => {
    console.log('✅ User logged in:', user.username);
    setCurrentUser(user);
    saveCurrentUser(user);
    setShowLogin(false);
    setToastMessage(`Welcome back, ${user.name}! 👋`);
    
    // Load favorites from backend if available
    if (isBackendAvailable) {
      try {
        console.log('🔄 Loading favorites from backend...');
        const serverFavorites = await fetchUserFavorites(user.id);
        
        // Convert backend format to frontend format
        const convertedFavorites: Favorite[] = serverFavorites.map(fav => ({
          idiom: fav.idiom,
          language: fav.language as Language,
          info: {
            meaning: fav.meaning,
            history: fav.history,
            examples: fav.examples
          },
          audioData: fav.audio_url, // S3 URL instead of base64
          savedAt: fav.saved_at
        }));
        
        setFavorites(convertedFavorites);
        console.log(`✅ Loaded ${convertedFavorites.length} favorites from backend`);
        setToastMessage(`Welcome back! ${convertedFavorites.length} favorites synced 🎉`);
      } catch (error) {
        console.error('❌ Failed to load favorites from backend:', error);
        setToastMessage('⚠️ Using local favorites only');
      }
    }
  };
  
  const handleLogout = () => {
    console.log('👋 User logged out');
    logout();
    setCurrentUser(null);
    setFavorites([]);
    setShowLogin(true);
    setToastMessage('Logged out successfully');
  };

  const fetchIdiomDetails = useCallback(async (idiom: string, lang: Language) => {
    if (!config) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
    }
    resetRelatedState();
    setAppState(AppState.LOADING);
    setIdiomInfo(null);
    setErrorMessage(null);
    setCurrentIdiom(idiom);
    setLanguage(lang);
    setCrossLanguageIdioms(null);

    try {
      const info = await getIdiomInfo(idiom, lang);
      setIdiomInfo(info);
      setAppState(AppState.SUCCESS);

      // Fetch cross-language idioms in the background
      setIsCrossLangLoading(true);
      try {
        const allLanguages = Object.keys(config.languages) as Language[];
        const crossLangResult = await getCrossLanguageIdioms(idiom, lang, allLanguages);
        setCrossLanguageIdioms(crossLangResult);
      } catch (crossErr) {
        console.error("Failed to get cross-language idioms:", crossErr);
        setCrossLanguageIdioms({});
      } finally {
        setIsCrossLangLoading(false);
      }

    } catch (err: any) {
      console.error("Failed to get idiom info:", err);
      // Use the detailed error message from the service
      const errorMsg = err?.message || "Sorry, I couldn't find information for this idiom. Please try another one.";
      setErrorMessage(errorMsg);
      setAppState(AppState.ERROR);
    }
  }, [config]);
  
  const fetchNewIdiom = useCallback((lang: Language = language) => {
    if (!config) return;
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    const langIdioms = config.languages[lang].idioms;
    const newIdiom = langIdioms[Math.floor(Math.random() * langIdioms.length)];
    fetchIdiomDetails(newIdiom, lang);
  }, [language, fetchIdiomDetails, config]);

  const fetchNextFavorite = useCallback(() => {
    if (favorites.length === 0) {
      setViewMode(ViewMode.ALL);
      fetchNewIdiom();
      return;
    }
    const nextIndex = (currentFavoriteIndex + 1) % favorites.length;
    setCurrentFavoriteIndex(nextIndex);
    const nextFavorite = favorites[nextIndex];
    
    // Load from offline storage instead of making API call
    setAppState(AppState.LOADING);
    setCurrentIdiom(nextFavorite.idiom);
    setLanguage(nextFavorite.language);
    setIdiomInfo(nextFavorite.info);
    setAppState(AppState.SUCCESS);
    setCrossLanguageIdioms(null);
  }, [favorites, currentFavoriteIndex, fetchNewIdiom]);

  const handleNextIdiom = () => {
    if (viewMode === ViewMode.FAVORITES) {
      fetchNextFavorite();
    } else {
      fetchNewIdiom();
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value as Language;
    setLanguage(newLanguage);
    setViewMode(ViewMode.ALL);
    fetchNewIdiom(newLanguage);
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !searchQuery.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setViewMode(ViewMode.ALL);
    setIsSearching(true);
    setIsSearchLoading(true);
    setSearchResults([]);
    setErrorMessage(null);

    try {
      const allLanguages = Object.keys(config.languages) as Language[];
      const results = await performIdiomSearch(searchQuery, allLanguages);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed:", err);
      setErrorMessage("Sorry, the search failed. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleResultClick = (result: { idiom: string; language: Language }) => {
    setIsSearching(false);
    setSearchQuery('');
    fetchIdiomDetails(result.idiom, result.language);
  };

  const handleToggleAudio = async () => {
    if (isAudioPlaying && audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsAudioPlaying(false);
        return;
    }

    if (!idiomInfo || isAudioLoading) return;

    if (!idiomInfo.examples || idiomInfo.examples.length === 0) {
      setErrorMessage("No example available to play.");
      return;
    }

    setIsAudioLoading(true);
    setErrorMessage(null);
    
    try {
      // Create or get audio context - must be done in user gesture for mobile
      const audioContext = getAudioContext();
      
      // Resume audio context if suspended (required for mobile browsers)
      if (audioContext.state === 'suspended') {
        console.log('Resuming suspended audio context...');
        await audioContext.resume();
      }
      
      console.log('AudioContext state:', audioContext.state);
      
      // Check if we have saved audio data for this favorite
      const savedFavorite = favorites.find(fav => fav.idiom === currentIdiom && fav.language === language);
      let base64Audio: string;
      
      if (savedFavorite?.audioData) {
        console.log('Using saved audio from favorites');
        base64Audio = savedFavorite.audioData;
      } else {
        // Fetch the audio data from API
        const textToSpeak = `${currentIdiom}. As in: ${idiomInfo.examples[0]}`;
        console.log('Fetching TTS for:', textToSpeak);
        base64Audio = await getTextToSpeech(textToSpeak);
      }
      
      console.log('Audio data ready, length:', base64Audio.length);

      // Decode the audio
      const audioBytes = decode(base64Audio);
      console.log('Decoded audio bytes:', audioBytes.length);
      
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      console.log('Audio buffer created, duration:', audioBuffer.duration);
      
      // Create and play the audio source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      audioSourceRef.current = source;
      
      source.onended = () => {
          console.log('Audio playback ended');
          setIsAudioPlaying(false);
          audioSourceRef.current = null;
      };
      
      // Start playback
      source.start(0);
      console.log('Audio playback started');
      
      setIsAudioLoading(false);
      setIsAudioPlaying(true);
    } catch (err: any) {
      console.error("Failed to play audio:", err);
      console.error("Error details:", err.message, err.stack);
      setErrorMessage(`Audio playback failed: ${err.message || 'Unknown error'}`);
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
    }
  };
  
  const handleToggleFavorite = async () => {
    if (!currentIdiom || !idiomInfo) return;
    const isFavorite = favorites.some(fav => fav.idiom === currentIdiom && fav.language === language);
    
    if (isFavorite) {
      // Delete from backend if available
      if (isBackendAvailable && currentUser) {
        try {
          await deleteFavoriteFromBackend(currentUser.id, currentIdiom, language);
          console.log('✅ Deleted from backend');
        } catch (error) {
          console.error('❌ Failed to delete from backend:', error);
        }
      }
      
      const updatedFavorites = favorites.filter(fav => !(fav.idiom === currentIdiom && fav.language === language));
      setFavorites(updatedFavorites);
      setToastMessage('Removed from favorites');
      if(viewMode === ViewMode.FAVORITES && updatedFavorites.length === 0) {
        setViewMode(ViewMode.ALL);
      }
    } else {
      // Check if we've reached the limit
      if (favorites.length >= 50) {
        setToastMessage('⚠️ Maximum 50 favorites reached. Remove some to add new ones.');
        return;
      }
      
      setToastMessage('💾 Saving to favorites...');
      
      try {
        // Fetch audio data
        let audioData: string | undefined;
        try {
          const textToSpeak = `${currentIdiom}. As in: ${idiomInfo.examples[0]}`;
          audioData = await getTextToSpeech(textToSpeak);
          console.log('Audio generated, size:', audioData.length);
        } catch (err) {
          console.warn('Could not generate audio:', err);
        }
        
        // Save to backend if available
        if (isBackendAvailable && currentUser) {
          try {
            setToastMessage('☁️ Uploading to cloud...');
            const result = await saveFavoriteToBackend(
              currentUser.id,
              currentIdiom,
              language,
              idiomInfo,
              audioData
            );
            
            // Create favorite with S3 URL
            const newFavorite: Favorite = {
              idiom: currentIdiom,
              language,
              info: idiomInfo,
              audioData: result.audioUrl, // S3 URL
              savedAt: Date.now()
            };
            
            const updatedFavorites = [newFavorite, ...favorites].slice(0, 50);
            setFavorites(updatedFavorites);
            setToastMessage(`✨ Saved to cloud! (${updatedFavorites.length}/50) Synced across devices 🌐`);
          } catch (backendError) {
            console.error('Backend save failed, falling back to local:', backendError);
            // Fallback to local storage
            const newFavorite: Favorite = {
              idiom: currentIdiom,
              language,
              info: idiomInfo,
              audioData,
              savedAt: Date.now()
            };
            const updatedFavorites = [newFavorite, ...favorites].slice(0, 50);
            setFavorites(updatedFavorites);
            setToastMessage(`✨ Saved locally! (${updatedFavorites.length}/50) Local only.`);
          }
        } else {
          // No backend, save locally only
          const newFavorite: Favorite = {
            idiom: currentIdiom,
            language,
            info: idiomInfo,
            audioData,
            savedAt: Date.now()
          };
          const updatedFavorites = [newFavorite, ...favorites].slice(0, 50);
          setFavorites(updatedFavorites);
          setToastMessage(`✨ Saved locally! (${updatedFavorites.length}/50)`);
        }
      } catch (err) {
        console.error('Error saving favorite:', err);
        setToastMessage('❌ Failed to save favorite. Please try again.');
      }
    }
  };

  const handleToggleViewMode = () => {
    const newMode = viewMode === ViewMode.ALL ? ViewMode.FAVORITES : ViewMode.ALL;
    setViewMode(newMode);
    
    if (newMode === ViewMode.FAVORITES) {
      // Clear current idiom to show the favorites list
      setCurrentIdiom(null);
      setIdiomInfo(null);
      setAppState(AppState.IDLE);
      setCurrentFavoriteIndex(0);
    } else {
      // When switching back to All, fetch a new idiom
      fetchNewIdiom();
    }
  };
  
  const handleShowRelated = async () => {
    if (!currentIdiom || appState !== AppState.SUCCESS) return;

    originalIdiomRef.current = { idiom: currentIdiom, lang: language };
    setIsShowingRelated(true);
    setIsRelatedLoading(true);
    setRelatedIdioms(null);
    setRelatedError(null);

    try {
        const result = await getRelatedIdioms(currentIdiom, language);
        setRelatedIdioms(result);
    } catch (err) {
        console.error("Failed to get related idioms:", err);
        setRelatedError("Could not find related idioms. Please try again later.");
    } finally {
        setIsRelatedLoading(false);
    }
  };
  
  const handleBackToOriginal = () => {
    if (originalIdiomRef.current) {
        fetchIdiomDetails(originalIdiomRef.current.idiom, originalIdiomRef.current.lang);
    }
    resetRelatedState();
  };
  
  const handleSelectRelated = (idiom: string) => {
    fetchIdiomDetails(idiom, language);
    resetRelatedState();
  };

  const isCurrentFavorite = favorites.some(fav => fav.idiom === currentIdiom && fav.language === language);
  
  const renderInstallModal = () => {
    if (!isInstallModalOpen) return null;

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    return (
        <div className="modal-overlay" onClick={() => setIsInstallModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={() => setIsInstallModalOpen(false)} aria-label="Close">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                <h3 className="modal-title">Install FiguroAI</h3>
                <div className="modal-instructions">
                    {isIOS && (
                        <>
                            <p>To install the app on your Apple device:</p>
                            <ol>
                                <li>Tap the <strong>Share</strong> icon in Safari.</li>
                                <li>Scroll down and tap <strong>'Add to Home Screen'</strong>.</li>
                                <li>Tap <strong>'Add'</strong> in the top right corner.</li>
                            </ol>
                        </>
                    )}
                    {isAndroid && (
                         <>
                            <p>To install the app on your Android device:</p>
                            <ol>
                                <li>Tap the <strong>Menu</strong> icon (3 dots) in Chrome.</li>
                                <li>Tap <strong>'Install app'</strong> or <strong>'Add to Home Screen'</strong>.</li>
                                <li>Follow the on-screen prompts.</li>
                            </ol>
                        </>
                    )}
                    {!isIOS && !isAndroid && (
                        <p>Open this page on your mobile device to install the app to your home screen for easy access.</p>
                    )}
                </div>
            </div>
        </div>
    );
  };

  const renderCrossLanguageSection = () => {
    if (isCrossLangLoading) {
      return (
        <div className="idiom-section cross-lang-section">
          <h3>In Other Languages</h3>
          <div className="mini-loading-container">
            <div className="btn-spinner"></div>
            <span>Finding translations...</span>
          </div>
        </div>
      );
    }

    if (!crossLanguageIdioms || Object.keys(crossLanguageIdioms).length === 0) {
      return null;
    }

    return (
      <div className="idiom-section cross-lang-section">
        <h3>In Other Languages</h3>
        <div className="cross-lang-list">
          {Object.entries(crossLanguageIdioms).map(([lang, idiom]) => (
            idiom && (
              <div key={lang} className="cross-lang-item">
                <strong>In {lang}:</strong>
                <button onClick={() => fetchIdiomDetails(idiom, lang as Language)}>
                  {idiom}
                </button>
              </div>
            )
          ))}
        </div>
      </div>
    );
  }
  
  const renderCardContent = () => {
    if (isShowingRelated) {
        if (isRelatedLoading) {
             return (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Finding related idioms...</p>
              </div>
            );
        }
        if (relatedError) {
             return (
              <div className="error-container">
                <h3>Oops!</h3>
                <p>{relatedError}</p>
                <button onClick={handleBackToOriginal} className="btn btn-secondary mt-4">Back</button>
              </div>
            );
        }
        return (
            <div className="related-container">
                <div className="related-header">
                    <h3>Related to "{originalIdiomRef.current?.idiom}"</h3>
                    <button onClick={handleBackToOriginal} className="btn btn-secondary">
                        <ArrowUturnLeftIcon className="w-5 h-5"/>
                        Back
                    </button>
                </div>
                {relatedIdioms && relatedIdioms.length > 0 ? (
                    <ul className="related-list">
                        {relatedIdioms.map((idiom, index) => (
                            <li key={index}>
                                <button className="related-item" onClick={() => handleSelectRelated(idiom)}>
                                    {idiom}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="placeholder-container">
                        <p>No related idioms were found.</p>
                    </div>
                )}
            </div>
        )
    }

    if (isSearching) {
        if (isSearchLoading) {
            return (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Searching for idioms...</p>
              </div>
            );
        }

        return (
            <div className="search-results-container">
                <h3 className="search-results-header">Results for "{searchQuery}"</h3>
                {errorMessage && <p className="error-message">{errorMessage}</p>}
                {!errorMessage && searchResults.length > 0 ? (
                    <ul className="search-results-list">
                        {searchResults.map((result, index) => (
                            <li key={index}>
                                <button className="search-result-item" onClick={() => handleResultClick(result)}>
                                    <span className="search-result-idiom">{result.idiom}</span>
                                    <span className="search-result-lang">{result.language}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    !errorMessage &&
                    <div className="placeholder-container">
                        <p>No idioms found matching your search.</p>
                    </div>
                )}
            </div>
        );
    }

    if (viewMode === ViewMode.FAVORITES) {
        if (favorites.length === 0) {
            return (
                <div className="placeholder-container">
                    <StarIcon className="w-12 h-12 text-gray-500 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-300">No Favorites Yet</h3>
                    <p>Click the star on an idiom to save it here.</p>
                </div>
            );
        }
        
        // If no current idiom is loaded, show the list
        if (!currentIdiom || appState !== AppState.SUCCESS) {
            return (
                <div className="favorites-list-container">
                    <h3 className="favorites-list-header">
                        My Favorites ({favorites.length}/50)
                    </h3>
                    <ul className="favorites-list">
                        {favorites.map((favorite, index) => (
                            <li key={`${favorite.idiom}-${favorite.language}-${favorite.savedAt}`}>
                                <button 
                                    className="favorite-list-item"
                                    onClick={() => {
                                        // Load the favorite
                                        setCurrentIdiom(favorite.idiom);
                                        setLanguage(favorite.language);
                                        setIdiomInfo(favorite.info);
                                        setAppState(AppState.SUCCESS);
                                        setCrossLanguageIdioms(null);
                                        setCurrentFavoriteIndex(index);
                                    }}
                                >
                                    <div className="favorite-item-content">
                                        <span className="favorite-item-idiom">{favorite.idiom}</span>
                                        <span className="favorite-item-lang">{favorite.language}</span>
                                    </div>
                                    <div className="favorite-item-meta">
                                        {favorite.audioData && (
                                            <span className="favorite-has-audio" title="Has offline audio">🔊</span>
                                        )}
                                        <span className="favorite-item-date">
                                            {new Date(favorite.savedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        // If a favorite is loaded, fall through to show the idiom details below
    }

    switch (appState) {
      case AppState.LOADING:
        return (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Discovering idiom secrets...</p>
          </div>
        );
      case AppState.ERROR:
        return (
          <div className="error-container">
            <h3>Oops!</h3>
            <p className="error-message-main">{errorMessage}</p>
            {currentIdiom && (
              <p className="error-idiom">Idiom: "{currentIdiom}"</p>
            )}
            <div className="error-actions">
              <button onClick={handleNextIdiom} className="btn btn-primary">
                Try Another Idiom
              </button>
            </div>
          </div>
        );
      case AppState.SUCCESS:
        if (!idiomInfo || !currentIdiom) return null;
        return (
          <>
            <div className="idiom-header">
              <h2 className="idiom-text">{currentIdiom}</h2>
              <div className="idiom-actions">
                <button
                  onClick={handleToggleFavorite}
                  className={`btn-favorite ${isCurrentFavorite ? 'is-favorite' : ''}`}
                  aria-label={isCurrentFavorite ? "Remove from favorites" : "Add to favorites"}
                  title={isCurrentFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon className="favorite-icon" />
                </button>
                <button 
                  onClick={handleToggleAudio} 
                  disabled={isAudioLoading} 
                  className="btn btn-secondary" 
                  aria-label={isAudioPlaying ? "Stop audio playback" : "Listen to idiom"}
                >
                  {isAudioLoading ? (
                      <>
                          <div className="btn-spinner"></div>
                          Loading...
                      </>
                  ) : isAudioPlaying ? (
                      <>
                          <StopIcon className="w-6 h-6" />
                          Stop
                      </>
                  ) : (
                      <>
                          <SpeakerWaveIcon className="w-6 h-6" />
                          Listen
                      </>
                  )}
                </button>
              </div>
            </div>
            <div className="idiom-section">
              <h3>Meaning & History</h3>
              <p>{idiomInfo.meaning} {idiomInfo.history}</p>
            </div>
            <div className="idiom-section">
              <h3>Usage Examples</h3>
              <ul className="example-list">
                {idiomInfo.examples.map((ex, index) => (
                  <li key={index}><em>"{ex}"</em></li>
                ))}
              </ul>
            </div>
            {renderCrossLanguageSection()}
          </>
        );
      default:
        return (
            <div className="placeholder-container">
                <p>Select a language to begin your journey into the world of idioms.</p>
            </div>
        );
    }
  };
  
  if (configLoading) {
    return (
      <div className="app-container">
        <main className="idiom-card" role="main">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading Languages...</p>
          </div>
        </main>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="app-container">
        <main className="idiom-card" role="main">
          <div className="error-container">
            <h3>Configuration Error</h3>
            <p>{configError}</p>
          </div>
        </main>
      </div>
    );
  }

  // Show login screen if not logged in
  if (!currentUser) {
    return (
      <>
        {showLogin && <Login onLogin={handleLogin} />}
      </>
    );
  }

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-container">
          <img src="/FiguroAI_logo_transpernt_white.png" alt="FiguroAI Logo" className="logo" />
          <h1 className="title">FiguroAI</h1>
        </div>
        <div className="controls-container">
            {currentUser && (
              <div className="user-info">
                <span className="user-name">👤 {currentUser.name}</span>
                <button 
                    className="btn btn-secondary btn-sm"
                    onClick={handleLogout}
                    title="Logout"
                >
                  Logout
                </button>
              </div>
            )}
            <button 
                className="btn btn-secondary"
                onClick={() => setIsInstallModalOpen(true)}
            >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Install App
            </button>
            {viewMode === ViewMode.FAVORITES ? (
              <button 
                  className="btn btn-primary" 
                  onClick={handleToggleViewMode}
              >
                <ArrowUturnLeftIcon className="w-5 h-5" />
                Back to Home
              </button>
            ) : (
              <button 
                  className="btn btn-secondary favorites-btn" 
                  onClick={handleToggleViewMode}
                  disabled={favorites.length === 0}
              >
                <StarIcon className="w-5 h-5" />
                My Favorites
                {favorites.length > 0 && (
                  <span className="favorites-badge">{favorites.length}</span>
                )}
              </button>
            )}
            <div className="language-selector">
                <select 
                    className="language-select" 
                    value={language} 
                    onChange={handleLanguageChange}
                    aria-label="Select language"
                    disabled={isSearching || viewMode === ViewMode.FAVORITES}
                >
                    {config && Object.keys(config.languages).map(lang => (
                    <option key={lang} value={lang}>{lang}</option>
                    ))}
                </select>
            </div>
            <form className="search-form" onSubmit={handleSearch}>
                <input
                    type="search"
                    className="search-input"
                    placeholder="Search for an idiom..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    disabled={isSearchLoading}
                />
                <button type="submit" className="btn search-btn" aria-label="Search" disabled={isSearchLoading}>
                    {isSearchLoading ? <div className="btn-spinner"></div> : <MagnifyingGlassIcon className="w-5 h-5" />}
                </button>
            </form>
        </div>
      </header>
      
      <main className="idiom-card" role="main" aria-live="polite">
        {renderCardContent()}
      </main>
      
      <footer className="footer">
        <div className="controls">
            {viewMode === ViewMode.FAVORITES && currentIdiom && appState === AppState.SUCCESS ? (
              <>
                <button 
                  onClick={() => {
                    setCurrentIdiom(null);
                    setIdiomInfo(null);
                    setAppState(AppState.IDLE);
                  }} 
                  className="btn btn-secondary"
                >
                  <ArrowUturnLeftIcon className="w-5 h-5" />
                  Back to List
                </button>
                <button onClick={handleNextIdiom} disabled={appState === AppState.LOADING} className="btn btn-primary">
                  <ArrowPathIcon className="w-5 h-5" />
                  Next Favorite
                </button>
              </>
            ) : (
              <>
                <button onClick={handleNextIdiom} disabled={appState === AppState.LOADING || isShowingRelated} className="btn btn-primary">
                  <ArrowPathIcon className="w-5 h-5" />
                  Next Idiom
                </button>
                <button onClick={handleShowRelated} disabled={appState !== AppState.SUCCESS || isShowingRelated} className="btn btn-secondary">
                  <SparklesIcon className="w-5 h-5" />
                  Related Idioms
                </button>
              </>
            )}
        </div>
        <p className="copyright">&copy; 2024 FiguroAI.com | Chirag Kansara</p>
      </footer>
      {renderInstallModal()}
      
      {/* Login Modal */}
      {showLogin && <Login onLogin={handleLogin} />}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default App;