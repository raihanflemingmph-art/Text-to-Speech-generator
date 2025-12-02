
export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Male' | 'Female' | 'Custom';
  style: string;
  isCustom?: boolean;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  // Standard Gemini Voices
  { id: 'Puck', name: 'Puck', gender: 'Male', style: 'Soft, Narrative' },
  { id: 'Charon', name: 'Charon', gender: 'Male', style: 'Deep, Authoritative' },
  { id: 'Kore', name: 'Kore', gender: 'Female', style: 'Calm, Soothing' },
  { id: 'Fenrir', name: 'Fenrir', gender: 'Male', style: 'Energetic, Strong' },
  { id: 'Aoede', name: 'Aoede', gender: 'Female', style: 'Expressive, Bright' },
  
  // Requested & Expanded Voices (Mythology/Astronomy Theme)
  { id: 'Enceladus', name: 'Enceladus', gender: 'Male', style: 'Resonant, Heroic' },
  { id: 'Zephyr', name: 'Zephyr', gender: 'Female', style: 'Gentle, Airy' },
  { id: 'Titan', name: 'Titan', gender: 'Male', style: 'Heavy, Powerful' },
  { id: 'Miranda', name: 'Miranda', gender: 'Female', style: 'Young, Cheerful' },
  { id: 'Umbriel', name: 'Umbriel', gender: 'Male', style: 'Mysterious, Low' },
  { id: 'Ariel', name: 'Ariel', gender: 'Female', style: 'Light, Melodic' },
  { id: 'Oberon', name: 'Oberon', gender: 'Male', style: 'Regal, Commanding' },
  { id: 'Callisto', name: 'Callisto', gender: 'Female', style: 'Mature, Textured' },
  { id: 'Ganymede', name: 'Ganymede', gender: 'Male', style: 'Clear, Youthful' },
  { id: 'Europa', name: 'Europa', gender: 'Female', style: 'Elegant, Smooth' },
  { id: 'Io', name: 'Io', gender: 'Female', style: 'Intense, Sharp' },
  { id: 'Amalthea', name: 'Amalthea', gender: 'Female', style: 'Warm, Motherly' },
  { id: 'Himalia', name: 'Himalia', gender: 'Female', style: 'Distant, Ethereal' },
  { id: 'Elara', name: 'Elara', gender: 'Female', style: 'Soft, Whispering' },
  { id: 'Pasiphae', name: 'Pasiphae', gender: 'Female', style: 'Dark, Complex' },
  { id: 'Sinope', name: 'Sinope', gender: 'Female', style: 'Direct, Bold' },
  { id: 'Lysithea', name: 'Lysithea', gender: 'Female', style: 'Sweet, Light' },
  { id: 'Carme', name: 'Carme', gender: 'Female', style: 'Rich, Deep' },
  { id: 'Ananke', name: 'Ananke', gender: 'Female', style: 'Ancient, Slow' },
  { id: 'Leda', name: 'Leda', gender: 'Female', style: 'Playful, Bright' },
  { id: 'Thebe', name: 'Thebe', gender: 'Female', style: 'Fast, Energetic' },
  { id: 'Adrastea', name: 'Adrastea', gender: 'Female', style: 'Small, Delicate' },
  { id: 'Metis', name: 'Metis', gender: 'Female', style: 'Intellectual, Sharp' },
  { id: 'Mimas', name: 'Mimas', gender: 'Male', style: 'Small, Punchy' },
  { id: 'Tethys', name: 'Tethys', gender: 'Female', style: 'Flowing, Watery' },
  { id: 'Dione', name: 'Dione', gender: 'Female', style: 'Balanced, Neutral' },
  { id: 'Rhea', name: 'Rhea', gender: 'Female', style: 'Grand, Operatic' },
  { id: 'Hyperion', name: 'Hyperion', gender: 'Male', style: 'Bright, Radiant' },
  { id: 'Iapetus', name: 'Iapetus', gender: 'Male', style: 'Dual, Contrast' },
  { id: 'Phoebe', name: 'Phoebe', gender: 'Female', style: 'Quirky, Unique' }
];

export interface AudioState {
  isGenerating: boolean;
  isPlaying: boolean;
  audioBuffer: AudioBuffer | null;
  duration: number;
  currentTime: number;
}

export type Emotion = 'Happy' | 'Sad' | 'Angry' | 'Fearful' | 'Excited' | 'Crying';

export interface EmotionState {
  Happy: number;
  Sad: number;
  Angry: number;
  Fearful: number;
  Excited: number;
  Crying: number;
}
