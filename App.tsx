/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getType } from 'mime';
import { Logo } from './components/Logo';
import {
    ArrowDownTrayIcon,
    ArrowPathIcon,
    ArrowUturnLeftIcon,
    MagnifyingGlassIcon,
    SpeakerWaveIcon,
    StarIcon,
    StopIcon
} from './components/icons';
import {
    getItemInfo,
    getRelatedItems,
    getTextToSpeech,
    performIdiomSearch,
    getCrossLanguageIdioms
// FIX: Added .ts extension to the import path to resolve the module not found error.
} from './services/geminiService.ts';
import {
    Language,
    ItemInfo,
    Favorite,
    ViewMode,
    SearchResult,
    LearningMode,
    CrossLanguageIdioms
} from './types';

// Helper function to get a random item from an array
// FIX: Changed to a standard function declaration to resolve TSX parsing ambiguity with generics.
function getRandomItem<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

function App() {
    // App State
    const [appState, setAppState] = useState<'loading' | 'idle' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);

    // Config State
    const [languageConfig, setLanguageConfig] = useState<Record<string, { idioms: string[], words: string[] }>>({});
    const [availableLanguages, setAvailableLanguages] = useState<Language[]>([]);

    // Learning Mode State
    const [learningMode, setLearningMode] = useState<LearningMode>('idioms');

    // Current Item State
    const [currentItem, setCurrentItem] = useState<ItemInfo | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<Language>('English');
    const [currentPhrase, setCurrentPhrase] = useState<string>('');

    // Feature States
    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('All');
    const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
    const [relatedItems, setRelatedItems] = useState<string[] | null>(null);
    const [crossLanguageItems, setCrossLanguageItems] = useState<CrossLanguageIdioms | null>(null);
    const [isFetchingCrossLanguage, setIsFetchingCrossLanguage] = useState(false);

    // Audio State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Effect to initialize AudioContext
    useEffect(() => {
        // Safari compatibility
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
    }, []);

    // Effect to load languages config on startup
    useEffect(() => {
        const fetchLanguages = async () => {
            try {
                const response = await fetch('/languages.json');
                if (!response.ok) {
                    throw new Error(`Failed to load languages config: ${response.statusText}`);
                }
                const data = await response.json();
                const languages = Object.keys(data);
                setLanguageConfig(data);
                setAvailableLanguages(languages);
                setCurrentLanguage(languages[0] || 'English');
                setAppState('idle');
            } catch (e: any) {
                setError(e.message);
                setAppState('error');
            }
        };
        fetchLanguages();
    }, []);

    // Effect to load favorites from localStorage
    useEffect(() => {
        try {
            const storedFavorites = localStorage.getItem('figuro-favorites');
            if (storedFavorites) {
                setFavorites(JSON.parse(storedFavorites) as Favorite[]);
            }
        } catch (e) {
            console.error("Failed to parse favorites from localStorage", e);
        }
    }, []);

    // Effect to fetch initial item when config is ready
    useEffect(() => {
        if (appState === 'idle' && availableLanguages.length > 0) {
            fetchNewItem();
        }
    }, [appState, availableLanguages]);


    // Core function to fetch details for an idiom or word
    const fetchItemDetails = useCallback(async (phrase: string, lang: Language, type: LearningMode) => {
        setAppState('loading');
        setCurrentItem(null);
        setError(null);
        setCurrentPhrase(phrase);
        setCurrentLanguage(lang);
        setRelatedItems(null);
        setCrossLanguageItems(null);
        stopAudio();

        try {
            const info = await getItemInfo(phrase, lang, type);
            setCurrentItem(info);
            setAppState('idle');
            
            // Add a delay to prevent hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Fetch cross-language equivalents in the background
            setIsFetchingCrossLanguage(true);
            try {
                const crossLangIdioms = await getCrossLanguageIdioms(phrase, lang, availableLanguages, type);
                setCrossLanguageItems(crossLangIdioms);
            } catch (e: any) {
                // Log secondary error to console but don't block UI
                console.warn(`Could not fetch cross-language items: ${e.message}`);
            } finally {
                setIsFetchingCrossLanguage(false);
            }

        } catch (e: any) {
            setError(e.message);
            setAppState('error');
        }
    }, [availableLanguages]);

    // Function to get a new random item
    const fetchNewItem = useCallback(() => {
        let list: string[] = [];
        let lang = currentLanguage;

        if (viewMode === 'Favorites' && favorites.length > 0) {
            // FIX: Explicitly specify the generic type for getRandomItem to correct a type inference issue where `favorite` was being inferred as `unknown`.
            const favorite = getRandomItem<Favorite>(favorites.filter(f => f.type === learningMode));
            if (favorite) {
                fetchItemDetails(favorite.phrase, favorite.language, favorite.type);
                return;
            }
        }

        const modeKey = learningMode === 'idioms' ? 'idioms' : 'words';
        list = languageConfig[lang]?.[modeKey] ?? [];

        if (list.length === 0) {
            setError(`No ${learningMode} available for ${lang}.`);
            return;
        }

        const phrase = getRandomItem(list);
        if (phrase) {
            fetchItemDetails(phrase, lang, learningMode);
        }
    }, [currentLanguage, viewMode, favorites, fetchItemDetails, learningMode, languageConfig]);


    // Handlers
    const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setCurrentLanguage(e.target.value as Language);
        // We need to fetch a new item for the newly selected language
        const modeKey = learningMode === 'idioms' ? 'idioms' : 'words';
        const list = languageConfig[e.target.value as Language]?.[modeKey] ?? [];
        const phrase = getRandomItem(list);
        if (phrase) {
            fetchItemDetails(phrase, e.target.value as Language, learningMode);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResults(null);
        setError(null);
        stopAudio();
        try {
            const results = await performIdiomSearch(searchQuery, availableLanguages, learningMode);
            setSearchResults(results);
        } catch (e: any) {
            setError('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
        }
    };

    const handleToggleFavorite = () => {
        if (!currentPhrase || !currentLanguage) return;
        const key = `${currentLanguage}-${currentPhrase}-${learningMode}`;
        let newFavorites;
        if (favorites.some(f => f.key === key)) {
            newFavorites = favorites.filter(f => f.key !== key);
        } else {
            newFavorites = [...favorites, { key, phrase: currentPhrase, language: currentLanguage, type: learningMode }];
        }
        setFavorites(newFavorites);
        localStorage.setItem('figuro-favorites', JSON.stringify(newFavorites));
    };

    const handleFetchRelated = async () => {
        if (!currentPhrase) return;
        setAppState('loading');
        try {
            const items = await getRelatedItems(currentPhrase, currentLanguage, learningMode);
            setRelatedItems(items);
            setAppState('idle');
        } catch (e: any) {
            setError((e as Error).message);
            setAppState('error');
        }
    };

    // Audio Playback
    const playAudio = async () => {
        if (!currentItem || !audioContextRef.current) return;

        setIsFetchingAudio(true);
        try {
            const textToSpeak = `${currentItem.item}. ${currentItem.examples[0]}`;
            const audioData = await getTextToSpeech(textToSpeak);

            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            const audioBuffer = await decodeAudioData(audioData, audioContextRef.current);
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => {
                setIsPlaying(false);
                audioSourceRef.current = null;
            };
            source.start(0);
            audioSourceRef.current = source;
            setIsPlaying(true);
        } catch (e) {
            console.error("Audio playback failed", e);
            setError("Sorry, could not play the audio.");
        } finally {
            setIsFetchingAudio(false);
        }
    };

    const stopAudio = () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
            setIsPlaying(false);
        }
    };

    const handlePlaybackToggle = () => {
        if (isPlaying) {
            stopAudio();
        } else {
            playAudio();
        }
    };

    // Audio decoding utility
    const decode = (base64: string): Uint8Array => {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    const decodeAudioData = async (
        data: string,
        ctx: AudioContext,
    ): Promise<AudioBuffer> => {
        const decodedData = decode(data);
        const dataInt16 = new Int16Array(decodedData.buffer);
        const frameCount = dataInt16.length / 1;
        const buffer = ctx.createBuffer(1, frameCount, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i] / 32768.0;
        }
        return buffer;
    };

    // Platform detection for install modal
    const getMobileOS = (): 'iOS' | 'Android' | 'Other' => {
        const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
        if (/android/i.test(userAgent)) return "Android";
        if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return "iOS";
        return "Other";
    };

    const os = getMobileOS();
    const isFavorite = favorites.some(f => f.key === `${currentLanguage}-${currentPhrase}-${learningMode}`);

    const handleLearningModeChange = (mode: LearningMode) => {
        if (mode === learningMode) return;
        setLearningMode(mode);
        // Reset view when mode changes
        setCurrentItem(null);
        setSearchResults(null);
        setRelatedItems(null);
        setCrossLanguageItems(null);
        // Fetch a new item for the new mode
        const modeKey = mode === 'idioms' ? 'idioms' : 'words';
        const list = languageConfig[currentLanguage]?.[modeKey] ?? [];
        const phrase = getRandomItem(list);
        if (phrase) {
            fetchItemDetails(phrase, currentLanguage, mode);
        } else {
             setError(`No ${mode} available for ${currentLanguage}.`);
        }
    }


    return (
        <div className="app-container">
            <header className="app-header">
                <div className="title-container">
                    <Logo className="logo" />
                    <h1 className="app-title">FiguroAI</h1>
                </div>

                <div className="controls header-controls">
                    <div className="segmented-control">
                        <button
                            onClick={() => handleLearningModeChange('idioms')}
                            className={learningMode === 'idioms' ? 'active' : ''}
                            aria-pressed={learningMode === 'idioms'}
                        >
                            Idioms
                        </button>
                        <button
                            onClick={() => handleLearningModeChange('words')}
                            className={learningMode === 'words' ? 'active' : ''}
                            aria-pressed={learningMode === 'words'}
                        >
                            Words
                        </button>
                    </div>

                    <select
                        value={currentLanguage}
                        onChange={handleLanguageChange}
                        className="language-selector"
                        aria-label="Select Language"
                        disabled={appState === 'loading'}
                    >
                        {availableLanguages.map(lang => (
                            <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </select>
                    <button
                        className="btn-secondary"
                        onClick={() => {
                            if (viewMode === 'All') setViewMode('Favorites');
                            else setViewMode('All');
                        }}
                    >
                        {viewMode === 'All' ? 'My Favorites' : 'Show All'}
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => setIsInstallModalOpen(true)}
                        aria-label="Install App"
                    >
                        <ArrowDownTrayIcon className="icon" /> Install
                    </button>
                </div>
            </header>
            <main className="main-content">
                <form className="search-form" onSubmit={handleSearch}>
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={`Search for ${learningMode}...`}
                        className="search-input"
                    />
                    <button type="submit" className="btn-primary search-btn" disabled={isSearching}>
                        {isSearching ? <div className="spinner-small"></div> : <MagnifyingGlassIcon className="icon" />}
                    </button>
                </form>

                <div className="card">
                    {appState === 'loading' && <div className="spinner"></div>}
                    {appState === 'error' && <p className="error-message">Error: {error}</p>}
                    {appState === 'idle' && (
                        <>
                            {searchResults ? (
                                <div className="search-results">
                                    <h2 className="card-subtitle">Results for "{searchQuery}"</h2>
                                    <ul className="search-results-list">
                                        {searchResults.map((result) => (
                                            <li key={`${result.language}-${result.phrase}`}>
                                                <button onClick={() => fetchItemDetails(result.phrase, result.language, result.type)}>
                                                    <strong>{result.phrase}</strong> ({result.language})
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                    {searchResults.length === 0 && <p>No results found.</p>}
                                    <button
                                        className="btn-secondary"
                                        onClick={() => {
                                            setSearchResults(null);
                                            setSearchQuery('');
                                            fetchNewItem();
                                        }}
                                    >
                                        Back to random {learningMode}
                                    </button>
                                </div>
                            ) : relatedItems ? (
                                <div className="related-items">
                                    <div className="related-items-header">
                                        <h2 className="card-subtitle">Related {learningMode}</h2>
                                        <button onClick={() => setRelatedItems(null)} className="btn-icon" aria-label="Back">
                                            <ArrowUturnLeftIcon className="icon" />
                                        </button>
                                    </div>
                                    <ul className="related-items-list">
                                        {relatedItems.map((item) => (
                                            <li key={item}>
                                                <button onClick={() => fetchItemDetails(item, currentLanguage, learningMode)}>{item}</button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : currentItem ? (
                                <>
                                    <div className="card-header">
                                        <h2 className="card-title">{currentItem.item}</h2>
                                        <button onClick={handleToggleFavorite} className={`btn-icon ${isFavorite ? 'is-favorite' : ''}`} aria-label="Toggle Favorite">
                                            <StarIcon className="icon" fill={isFavorite ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>
                                    <div className="card-body">
                                        <p><strong>Meaning:</strong> {currentItem.meaning}</p>
                                        <p><strong>Background:</strong> {currentItem.history}</p>
                                        <p><strong>Usage Examples:</strong></p>
                                        <ul className="example-list">
                                            {currentItem.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                                        </ul>
                                    </div>
                                    {crossLanguageItems && (
                                        <div className="cross-language-section">
                                            <h3>In Other Languages</h3>
                                            {isFetchingCrossLanguage ? (
                                                <div className="mini-loader"></div>
                                            ) : (
                                            <ul className="cross-language-list">
                                                {Object.entries(crossLanguageItems).map(([lang, phrase]) => (
                                                   phrase && <li key={lang}>
                                                        <button onClick={() => fetchItemDetails(phrase, lang, learningMode)}>
                                                            <strong>{lang}:</strong> {phrase}
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                !error && <p>Select a language to begin.</p>
                            )}
                        </>
                    )}
                </div>
                <div className="footer">
                     <div className="controls">
                        <button className="btn-secondary" onClick={handlePlaybackToggle} disabled={!currentItem || isFetchingAudio}>
                            {isFetchingAudio ? (
                                <div className="spinner-small"></div>
                            ) : isPlaying ? (
                                <><StopIcon className="icon" /> Stop</>
                            ) : (
                                <><SpeakerWaveIcon className="icon" /> Listen</>
                            )}
                        </button>
                        <button className="btn-secondary" onClick={handleFetchRelated} disabled={!currentItem}>
                           Related {learningMode}
                        </button>
                        <button className="btn-primary" onClick={() => {
                            setSearchResults(null);
                            setSearchQuery('');
                            fetchNewItem();
                        }}>
                           Next {learningMode === 'idioms' ? 'Idiom' : 'Word'} <ArrowPathIcon className="icon" />
                        </button>
                    </div>
                    <p className="copyright">&copy; 2024 Chirag Kansara - FiguroAI.com</p>
                </div>

            </main>

            {isInstallModalOpen && (
                <div className="modal-overlay" onClick={() => setIsInstallModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setIsInstallModalOpen(false)}>&times;</button>
                        <h2 className="modal-title">Install FiguroAI</h2>
                        {os === 'iOS' && (
                            <div>
                                <p>To install this app on your iPhone or iPad:</p>
                                <ol className="modal-instructions">
                                    <li>Tap the <strong>Share</strong> button in Safari.</li>
                                    <li>Scroll down and tap <strong>'Add to Home Screen'</strong>.</li>
                                    <li>Confirm by tapping <strong>'Add'</strong>.</li>
                                 </ol>
                            </div>
                        )}
                        {os === 'Android' && (
                            <div>
                                <p>To install this app on your Android device:</p>
                                <ol className="modal-instructions">
                                    <li>Tap the <strong>three dots</strong> in the top-right corner of Chrome.</li>
                                    <li>Tap <strong>'Install app'</strong> or <strong>'Add to Home screen'</strong>.</li>
                                    <li>Follow the on-screen prompts.</li>
                                </ol>
                            </div>
                        )}
                        {os === 'Other' && (
                            <p>Check your browser's settings for an "Install" or "Add to Home Screen" option to install this application.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
