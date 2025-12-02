
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Download, Settings2, Mic2, AlertCircle, Loader2, Volume2, Globe, Sliders, Upload, RefreshCw, Plus, Check } from 'lucide-react';
import Toggle from './components/Toggle';
import EmotionEqualizer from './components/EmotionEqualizer';
import { VOICE_OPTIONS, VoiceOption, EmotionState } from './types';
import { generateSpeech } from './services/geminiService';
import { decodeAudioData, audioBufferToWav, concatenateAudioBuffers } from './utils/audioUtils';

// --- Constants ---
const MAX_DESC_CHARS = 7000; 
const MAX_TEXT_CHARS = 50000; 
const CHUNK_SIZE = 2500; // Safe character limit per chunk to avoid 8192 token limit (approx < 1000 tokens)

const App: React.FC = () => {
  // --- State ---
  const [mode, setMode] = useState<'general' | 'cloning'>('general');
  const [description, setDescription] = useState('');
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[2]); // Default 'Kore'
  
  // Set default language to English
  const [language, setLanguage] = useState('English');
  
  // Custom Voices State
  const [customVoices, setCustomVoices] = useState<VoiceOption[]>([
    {
      id: 'custom-rj-raihan',
      name: 'R J Raihan',
      gender: 'Custom',
      style: 'Deep, energetic, radio-host style',
      isCustom: true
    }
  ]);
  
  // Emotional Equalizer State
  const [emotions, setEmotions] = useState<EmotionState>({
    Happy: 0,
    Sad: 0,
    Angry: 0,
    Fearful: 0,
    Excited: 0,
    Crying: 0
  });

  // Speed State (0 = Slow, 50 = Normal, 100 = Fast)
  const [speed, setSpeed] = useState<number>(50);

  // Cloning State
  const [cloneSample, setCloneSample] = useState<File | null>(null);
  const [cloningName, setCloningName] = useState('');
  const [cloningStyle, setCloningStyle] = useState('');

  // Audio State
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingText, setLoadingText] = useState('Generating Voice');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  
  // Track current generation ID to handle interruptions
  const generationIdRef = useRef<number>(0);

  // --- Effects ---
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // --- Handlers ---

  const handleModeToggle = (target: 'general' | 'cloning') => {
    setMode(target);
    stopAudio();
    setAudioBuffer(null);
    setCurrentTime(0);
    setError(null);
  };

  const handleVoiceSelect = (voice: VoiceOption) => {
    // If currently generating, 'cancel' it effectively by incrementing ID
    if (isGenerating) {
       generationIdRef.current += 1; // Invalidate current request
       setIsGenerating(false);
    }
    stopAudio();
    setSelectedVoice(voice);
    // Automatically switch back to general mode if a voice is selected
    if (mode === 'cloning') {
        setMode('general');
    }
  };

  const handleAddCustomVoice = () => {
    if (!cloningName.trim()) {
      setError("Please give your voice a name.");
      return;
    }

    const newVoice: VoiceOption = {
      id: `custom-${Date.now()}`,
      name: cloningName,
      gender: 'Custom',
      style: cloningStyle || 'Custom Cloned Style',
      isCustom: true
    };

    setCustomVoices(prev => [newVoice, ...prev]);
    setSelectedVoice(newVoice);
    setMode('general');
    setCloningName('');
    setCloningStyle('');
    setCloneSample(null);
    setError(null);
  };

  const stopAudio = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // ignore
      }
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const handleEmotionChange = (emotion: keyof EmotionState, value: number) => {
    setEmotions(prev => ({ ...prev, [emotion]: value }));
  };
  
  const handleSpeedChange = (value: number) => {
    setSpeed(value);
  };

  const chunkText = (inputText: string, limit: number): string[] => {
    const chunks: string[] = [];
    let currentChunk = "";
    
    // Split by sentence terminators (English: .?! | Bengali: । | Newline)
    const sentences = inputText.split(/([.?!।\n]+)/); 

    for (let i = 0; i < sentences.length; i++) {
        const part = sentences[i];
        
        if (/^[.?!।\n]+$/.test(part)) {
            currentChunk += part;
            continue;
        }

        if ((currentChunk + part).length > limit && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        
        currentChunk += part;
    }
    
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }
    
    return chunks;
  };

  const handleStop = () => {
    generationIdRef.current += 1; // Invalidate current process
    setIsGenerating(false);
    setLoadingText('Generate Voice');
    setError(null);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter some text to generate audio.");
      return;
    }
    
    stopAudio();
    setIsGenerating(true);
    setError(null);
    setAudioBuffer(null);
    setCurrentTime(0);
    setLoadingText('Initializing...');

    // Create a new ID for this generation attempt
    const currentGenId = generationIdRef.current + 1;
    generationIdRef.current = currentGenId;

    try {
      // Construct prompt instructions
      const activeEmotions = (Object.entries(emotions) as [string, number][])
        .filter(([_, val]) => val > 0)
        .map(([key, val]) => `${key}: ${val}%`)
        .join(', ');

      let speedInstruction = '';
      if (speed < 40) speedInstruction = 'Speaking Pace: Very Slow';
      else if (speed < 48) speedInstruction = 'Speaking Pace: Slow';
      else if (speed > 60) speedInstruction = 'Speaking Pace: Very Fast';
      else if (speed > 52) speedInstruction = 'Speaking Pace: Fast';
      
      let fullDescription = description;
      let instructionParts = [];
      
      instructionParts.push("Style: Ultra-realistic, human-like, natural conversational tone with breathiness, natural pauses, and varying intonation. Do not sound robotic.");

      if (activeEmotions) instructionParts.push(`Emotional Tone: [${activeEmotions}]`);
      if (speedInstruction) instructionParts.push(speedInstruction);
      if (fullDescription) instructionParts.push(fullDescription);
      
      if (selectedVoice.isCustom) {
          instructionParts.push(`Voice Identity: Imitate the style of "${selectedVoice.name}". Description: ${selectedVoice.style}.`);
      }

      const finalInstructions = instructionParts.join('. ');

      let voiceId = selectedVoice.isCustom ? 'Puck' : selectedVoice.id;
      const validIds = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede', 'Zephyr']; 
      if (!validIds.includes(voiceId) && !selectedVoice.isCustom) {
         voiceId = 'Puck'; 
         instructionParts.push(`Voice Character: ${selectedVoice.name} (${selectedVoice.style})`);
      }

      // Chunking logic
      const textChunks = chunkText(text, CHUNK_SIZE);
      const audioBuffers: AudioBuffer[] = [];
      
      for (let i = 0; i < textChunks.length; i++) {
          if (generationIdRef.current !== currentGenId) return; // Stop if cancelled

          setLoadingText(`Generating part ${i + 1}/${textChunks.length}...`);
          
          const chunk = textChunks[i];
          const base64Audio = await generateSpeech(
            chunk, 
            voiceId,
            finalInstructions.trim() ? finalInstructions : undefined
          );

          if (base64Audio && audioContextRef.current) {
            const buffer = await decodeAudioData(base64Audio, audioContextRef.current);
            audioBuffers.push(buffer);
          } else {
              throw new Error(`Failed to generate part ${i+1}`);
          }
      }

      if (generationIdRef.current !== currentGenId) return;

      if (audioBuffers.length > 0 && audioContextRef.current) {
          const finalBuffer = concatenateAudioBuffers(audioBuffers, audioContextRef.current);
          setAudioBuffer(finalBuffer);
      }
      
    } catch (err: any) {
        if (generationIdRef.current === currentGenId) {
            let msg = "Failed to generate speech.";
            if (err.message && err.message.includes("tokens")) {
                 msg = "Text is too complex for one segment. Try simpler text.";
            } else if (err.message) {
                 msg += ` ${err.message}`;
            }
            setError(msg);
        }
    } finally {
      if (generationIdRef.current === currentGenId) {
        setIsGenerating(false);
        setLoadingText('Generate Voice');
      }
    }
  };

  const handlePlayPause = async () => {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      stopAudio();
    } else {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        setCurrentTime(audioBuffer.duration);
        cancelAnimationFrame(animationFrameRef.current);
      };

      source.start(0);
      startTimeRef.current = audioContextRef.current.currentTime;
      sourceNodeRef.current = source;
      setIsPlaying(true);
      setCurrentTime(0);

      const updateProgress = () => {
        if (!audioContextRef.current) return;
        const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
        setCurrentTime(Math.min(elapsed, audioBuffer.duration));
        
        if (elapsed < audioBuffer.duration) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      updateProgress();
    }
  };

  const handleDownload = () => {
    if (!audioBuffer) return;
    const wavBlob = audioBufferToWav(audioBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tts-r-2.0-${selectedVoice.name}-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-800 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
               <Mic2 size={20} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">TTS-R 2.0</h1>
          </div>
          <div className="text-xs text-slate-500 hidden sm:block">Powered by Gemini 2.5 Flash</div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 overflow-hidden flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        
        {/* Left/Main Column: Controls & Text */}
        <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 gap-6">
          
          {/* Top Toggles */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-100 shrink-0">
            <div className="flex-1">
               <Toggle 
                 label="General Voice" 
                 isActive={mode === 'general'} 
                 onToggle={() => handleModeToggle('general')} 
               />
            </div>
            <div className="flex-1">
               <Toggle 
                 label="Cloning Voice" 
                 isActive={mode === 'cloning'} 
                 onToggle={() => handleModeToggle('cloning')} 
               />
            </div>
          </div>

          {mode === 'general' ? (
             <>
               {/* Settings Section (Description + EQ) */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4 shrink-0">
                
                {/* Tone Equalizer */}
                <div>
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
                    <Sliders size={16} />
                    Emotional Equalizer
                  </label>
                  <EmotionEqualizer 
                    emotions={emotions} 
                    speed={speed}
                    onEmotionChange={handleEmotionChange} 
                    onSpeedChange={handleSpeedChange}
                  />
                </div>

                {/* Manual Description */}
                <div className="relative group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <Settings2 size={16} />
                      Additional Instructions
                    </label>
                    <span className="text-xs text-slate-400">{description.length}/{MAX_DESC_CHARS}</span>
                  </div>
                  <textarea
                    className="w-full h-20 resize-none outline-none text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200"
                    placeholder="Describe specific details... (e.g., 'A pause after the first sentence', 'Whispering tone')"
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC_CHARS))}
                  />
                </div>
              </div>

              {/* Main Text Input - DARK THEME */}
              <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-700 p-4 flex-1 flex flex-col min-h-[300px] relative focus-within:ring-2 focus-within:ring-blue-500/40 transition-all">
                 <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-semibold text-slate-200">Text to Speech</label>
                  <div className="flex items-center gap-2">
                     <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 border border-slate-700">
                        <Globe size={12} />
                        <select 
                          className="bg-transparent outline-none cursor-pointer"
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                        >
                          <option value="English" className="bg-slate-800 text-white">US English</option>
                          <option value="Bengali" className="bg-slate-800 text-white">Bengali</option>
                          <option value="Spanish" className="bg-slate-800 text-white">Spanish</option>
                          <option value="Hindi" className="bg-slate-800 text-white">Hindi</option>
                        </select>
                     </div>
                     <span className="text-xs text-slate-400">{text.length}/{MAX_TEXT_CHARS}</span>
                  </div>
                </div>
                <textarea
                  className="w-full flex-1 resize-none outline-none text-base text-white leading-relaxed bg-transparent placeholder-slate-600"
                  placeholder={language === 'Bengali' ? "বাংলা বা ইংরেজী ভাষায় কিছু লিখুন..." : "Enter text here..."}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_CHARS))}
                />
                {error && (
                  <div className="absolute bottom-4 left-4 right-4 bg-red-900/90 text-red-100 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-700 shadow-sm z-30 backdrop-blur-sm">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky bottom-0 z-20 shrink-0">
                <button
                  onClick={isGenerating ? handleStop : handleGenerate}
                  disabled={!text && !isGenerating}
                  className={`flex-1 w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold text-white shadow-md transition-all active:scale-95 ${
                    isGenerating 
                      ? 'bg-blue-500 hover:bg-red-500' // Blue default, Red on hover to indicate STOP
                      : 'bg-blue-600 hover:bg-blue-700'
                  } ${(!text && !isGenerating) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{loadingText}</span>
                      <Square size={16} fill="currentColor" className="ml-2 opacity-80" />
                    </>
                  ) : (
                    <>
                      <Mic2 size={20} />
                      Generate Voice
                    </>
                  )}
                </button>

                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
                  <button 
                    onClick={handlePlayPause}
                    disabled={!audioBuffer}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all ${
                      isPlaying 
                      ? 'bg-amber-50 border-amber-200 text-amber-600' 
                      : audioBuffer 
                        ? 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100'
                        : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isPlaying ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5"/>}
                  </button>

                  <div className="flex flex-col w-24">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Time</span>
                    <span className="font-mono text-sm font-medium text-slate-700">
                       {formatTime(currentTime)} / {formatTime(audioBuffer?.duration || 0)}
                    </span>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

                <button
                  onClick={handleDownload}
                  disabled={!audioBuffer}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg border transition-all font-semibold ${
                    !audioBuffer 
                      ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Download size={20} />
                  <span>Download</span>
                </button>
              </div>
             </>
          ) : (
             // Cloning Mode UI
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex-1 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <div className="max-w-md w-full space-y-8">
                  <div className="text-center">
                     <h2 className="text-2xl font-bold text-slate-800">Create New Voice</h2>
                     <p className="text-slate-500 mt-2">Add a custom voice to your library.</p>
                  </div>

                  <div className="space-y-4">
                     {/* Upload Area (Optional) */}
                     <div className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center transition-colors ${cloneSample ? 'border-green-300 bg-green-50/50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                        {cloneSample ? (
                           <>
                             <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                               <Check size={32} />
                             </div>
                             <p className="text-sm font-semibold text-slate-700">{cloneSample.name}</p>
                             <p className="text-xs text-slate-500 mt-1">{(cloneSample.size / 1024 / 1024).toFixed(2)} MB</p>
                             <button onClick={() => setCloneSample(null)} className="mt-4 text-xs text-red-500 hover:underline">Remove</button>
                           </>
                        ) : (
                          <label className="flex flex-col items-center cursor-pointer w-full h-full">
                            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3">
                               <Upload size={28} />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Click to Upload Audio (Optional)</span>
                            <span className="text-xs text-slate-400 mt-1">WAV, MP3 (Max 10MB)</span>
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => setCloneSample(e.target.files?.[0] || null)} />
                          </label>
                        )}
                     </div>

                     {/* Inputs - DARK THEME */}
                     <div className="space-y-3">
                       <div>
                         <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Voice Name</label>
                         <input 
                           type="text" 
                           value={cloningName}
                           onChange={(e) => setCloningName(e.target.value)}
                           className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/40 outline-none text-sm"
                           placeholder="e.g. My Narrator Voice"
                         />
                       </div>
                       <div>
                         <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Style Description</label>
                         <input 
                           type="text" 
                           value={cloningStyle}
                           onChange={(e) => setCloningStyle(e.target.value)}
                           className="w-full p-3 rounded-lg border border-slate-600 bg-slate-800 text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/40 outline-none text-sm"
                           placeholder="e.g. Deep, raspy, fast-paced"
                         />
                       </div>
                     </div>

                     <button 
                       onClick={handleAddCustomVoice}
                       disabled={!cloningName}
                       className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                         !cloningName 
                         ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                         : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md active:scale-95'
                       }`}
                     >
                       <Plus size={18} />
                       Add to Library
                     </button>
                     
                     {error && <p className="text-xs text-red-500 text-center">{error}</p>}
                  </div>
                </div>
             </div>
          )}

        </div>

        {/* Right Sidebar: Voice Selection */}
        <div className="w-full md:w-80 bg-white border-l border-slate-200 flex flex-col h-auto md:h-full shrink-0">
          
          <div className="p-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Volume2 size={18} />
              Voice Artist ({VOICE_OPTIONS.length + customVoices.length})
            </h2>
            <p className="text-xs text-slate-500 mt-1">Select a voice to customize output</p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            
            {/* Custom Voices Section */}
            {customVoices.length > 0 && (
              <div className="mb-4">
                <div className="px-2 py-1 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">My Custom Voices</div>
                {customVoices.map((voice) => (
                  <div 
                    key={voice.id}
                    onClick={() => handleVoiceSelect(voice)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between mb-2 ${
                      selectedVoice.id === voice.id 
                        ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                        : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        selectedVoice.id === voice.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {voice.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 truncate">{voice.name}</div>
                        <div className="text-xs text-slate-500 truncate">{voice.style}</div>
                      </div>
                    </div>
                    {selectedVoice.id === voice.id && (
                       <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Standard Voices Section */}
            <div>
              {customVoices.length > 0 && <div className="px-2 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Standard Voices</div>}
              {VOICE_OPTIONS.map((voice) => (
                <div 
                  key={voice.id}
                  onClick={() => handleVoiceSelect(voice)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between mb-2 ${
                    selectedVoice.id === voice.id 
                      ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500' 
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selectedVoice.id === voice.id ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {voice.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{voice.name}</div>
                      <div className="text-xs text-slate-500 truncate">{voice.gender} • {voice.style}</div>
                    </div>
                  </div>
                  {selectedVoice.id === voice.id && (
                     <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 text-center">
             Model: gemini-2.5-flash-preview-tts
          </div>
        </div>

      </main>
    </div>
  );
};

export default App;
