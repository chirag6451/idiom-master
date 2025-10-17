/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, IdiomInfo, Language, Favorite, ViewMode, CrossLanguageIdioms, SearchResult } from './types';
import { getIdiomInfo, getTextToSpeech, getRelatedIdioms, getCrossLanguageIdioms, performIdiomSearch } from './services/geminiService';
import { ArrowPathIcon, SpeakerWaveIcon, StopIcon, MagnifyingGlassIcon, StarIcon, ArrowDownTrayIcon, XMarkIcon, SparklesIcon, ArrowUturnLeftIcon } from './components/icons';

// --- Data ---
const idioms: Record<Language, string[]> = {
  English: ['Bite the bullet', 'Break a leg', 'A piece of cake', 'Spill the beans'],
  Hindi: ['नौ दो ग्यारह होना', 'अंधों में काना राजा', 'ऊँट के मुँह में जीरा', 'घर का भेदी लंका ढाए'],
  Gujarati: ['પેટમાં બિલાડા બોલવા', 'પથ્થર પર પાણી', 'પાણીમાં બેસી જવું', 'મગનું નામ મરી ન પાડવું'],
};
const allLanguages = Object.keys(idioms) as Language[];

// --- Audio Utilities ---
// FIX: Changed return type from `UintArray` to `Uint8Array`.
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
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [language, setLanguage] = useState<Language>('English');
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
    try {
      const storedFavorites = localStorage.getItem('idiomFavorites');
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error("Failed to load favorites from localStorage:", error);
    }
    fetchNewIdiom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('idiomFavorites', JSON.stringify(favorites));
    } catch (error) {
      console.error("Failed to save favorites to localStorage:", error);
    }
  }, [favorites]);


  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  }, []);

  const resetRelatedState = () => {
    setIsShowingRelated(false);
    setRelatedIdioms(null);
    setRelatedError(null);
    originalIdiomRef.current = null;
  }

  const fetchIdiomDetails = useCallback(async (idiom: string, lang: Language) => {
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
        const crossLangResult = await getCrossLanguageIdioms(idiom, lang, allLanguages);
        setCrossLanguageIdioms(crossLangResult);
      } catch (crossErr) {
        console.error("Failed to get cross-language idioms:", crossErr);
        // Don't show an error, just fail gracefully
        setCrossLanguageIdioms({});
      } finally {
        setIsCrossLangLoading(false);
      }

    } catch (err) {
      console.error("Failed to get idiom info:", err);
      setErrorMessage("Sorry, I couldn't find information for this idiom. Please try another one.");
      setAppState(AppState.ERROR);
    }
  }, []);
  
  const fetchNewIdiom = useCallback((lang: Language = language) => {
    setIsSearching(false);
    setSearchQuery('');
    setSearchResults([]);
    const langIdioms = idioms[lang];
    const newIdiom = langIdioms[Math.floor(Math.random() * langIdioms.length)];
    fetchIdiomDetails(newIdiom, lang);
  }, [language, fetchIdiomDetails]);

  const fetchNextFavorite = useCallback(() => {
    if (favorites.length === 0) {
      setViewMode(ViewMode.ALL);
      fetchNewIdiom();
      return;
    }
    const nextIndex = (currentFavoriteIndex + 1) % favorites.length;
    setCurrentFavoriteIndex(nextIndex);
    const nextFavorite = favorites[nextIndex];
    fetchIdiomDetails(nextFavorite.idiom, nextFavorite.language);
  }, [favorites, currentFavoriteIndex, fetchIdiomDetails, fetchNewIdiom]);

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
    setViewMode(ViewMode.ALL); // Revert to all mode on language change
    fetchNewIdiom(newLanguage);
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
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
      const results = await performIdiomSearch(searchQuery);
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
      const textToSpeak = `${currentIdiom}. As in: ${idiomInfo.examples[0]}`;
      const base64Audio = await getTextToSpeech(textToSpeak);
      const audioContext = getAudioContext();
      
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audioBytes = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      audioSourceRef.current = source;
      
      source.onended = () => {
          setIsAudioPlaying(false);
          audioSourceRef.current = null;
      };
      
      source.start();
      setIsAudioLoading(false);
      setIsAudioPlaying(true);
    } catch (err) {
      console.error("Failed to play audio:", err);
      setErrorMessage("Sorry, couldn't play the audio.");
      setIsAudioLoading(false);
      setIsAudioPlaying(false);
    }
  };
  
  const handleToggleFavorite = () => {
    if (!currentIdiom) return;
    const isFavorite = favorites.some(fav => fav.idiom === currentIdiom && fav.language === language);
    
    if (isFavorite) {
      const updatedFavorites = favorites.filter(fav => !(fav.idiom === currentIdiom && fav.language === language));
      setFavorites(updatedFavorites);
      // If the last favorite is removed while in favorites view, switch back to ALL
      if(viewMode === ViewMode.FAVORITES && updatedFavorites.length === 0) {
        setViewMode(ViewMode.ALL);
      }
    } else {
      setFavorites([...favorites, { idiom: currentIdiom, language }]);
    }
  };

  const handleToggleViewMode = () => {
    const newMode = viewMode === ViewMode.ALL ? ViewMode.FAVORITES : ViewMode.ALL;
    setViewMode(newMode);
    
    if (newMode === ViewMode.FAVORITES) {
      setCurrentFavoriteIndex(-1); // Will become 0 on first "next" click
      if (favorites.length > 0) {
          const firstFavorite = favorites[0];
          fetchIdiomDetails(firstFavorite.idiom, firstFavorite.language);
      }
    } else {
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
    // When selecting a related idiom, we stay in the same language.
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
                <h3 className="modal-title">Install Idiom Master</h3>
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

    if (viewMode === ViewMode.FAVORITES && favorites.length === 0) {
        return (
            <div className="placeholder-container">
                <StarIcon className="w-12 h-12 text-gray-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-300">No Favorites Yet</h3>
                <p>Click the star on an idiom to save it here.</p>
            </div>
        );
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
            <p>{errorMessage}</p>
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
                  className={`btn-icon ${isCurrentFavorite ? 'is-favorite' : ''}`}
                  aria-label={isCurrentFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  <StarIcon className="w-6 h-6" />
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

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">Idiom Master</h1>
        <div className="controls-container">
            <button 
                className="btn btn-secondary"
                onClick={() => setIsInstallModalOpen(true)}
            >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Install App
            </button>
            <button 
                className="btn btn-secondary" 
                onClick={handleToggleViewMode}
                disabled={favorites.length === 0 && viewMode === ViewMode.ALL}
            >
              <StarIcon className="w-5 h-5" />
              {viewMode === ViewMode.ALL ? 'My Favorites' : 'Show All'}
            </button>
            <div className="language-selector">
                <select 
                    className="language-select" 
                    value={language} 
                    onChange={handleLanguageChange}
                    aria-label="Select language"
                    disabled={isSearching || viewMode === ViewMode.FAVORITES}
                >
                    {Object.keys(idioms).map(lang => (
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
      
      <footer className="controls">
        <button onClick={handleNextIdiom} disabled={appState === AppState.LOADING || isShowingRelated} className="btn btn-primary">
          <ArrowPathIcon className="w-5 h-5" />
          Next Idiom
        </button>
        <button onClick={handleShowRelated} disabled={appState !== AppState.SUCCESS || isShowingRelated} className="btn btn-secondary">
          <SparklesIcon className="w-5 h-5" />
          Related Idioms
        </button>
      </footer>
      {renderInstallModal()}
    </div>
  );
};

export default App;