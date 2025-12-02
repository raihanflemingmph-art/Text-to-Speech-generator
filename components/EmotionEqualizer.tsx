import React from 'react';
import { EmotionState } from '../types';
import { Zap } from 'lucide-react';

interface EmotionEqualizerProps {
  emotions: EmotionState;
  speed: number;
  onEmotionChange: (emotion: keyof EmotionState, value: number) => void;
  onSpeedChange: (value: number) => void;
  disabled?: boolean;
}

const EmotionEqualizer: React.FC<EmotionEqualizerProps> = ({ 
  emotions, 
  speed, 
  onEmotionChange, 
  onSpeedChange, 
  disabled 
}) => {
  const emotionKeys = Object.keys(emotions) as Array<keyof EmotionState>;

  return (
    <div className={`flex flex-col gap-6 p-4 bg-slate-50 rounded-lg border border-slate-100 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Vertical Emotion Sliders */}
      <div className="flex justify-between items-end gap-2 h-32">
        {emotionKeys.map((key) => (
          <div key={key} className="flex flex-col items-center gap-2 h-full flex-1">
            <div className="relative flex-1 w-full flex justify-center group">
              <input
                type="range"
                min="0"
                max="100"
                value={emotions[key]}
                onChange={(e) => onEmotionChange(key, parseInt(e.target.value))}
                className="absolute -rotate-90 top-1/2 -translate-y-1/2 h-2 w-24 origin-center cursor-pointer appearance-none bg-slate-200 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                style={{
                  background: `linear-gradient(to right, ${getColor(key)} ${emotions[key]}%, #e2e8f0 ${emotions[key]}%)`
                }}
              />
            </div>
            {/* Made bold as requested */}
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider truncate w-full text-center">{key}</span>
            <span className="text-xs font-bold text-slate-700">{emotions[key]}%</span>
          </div>
        ))}
      </div>

      {/* Horizontal Speed Slider */}
      <div className="pt-2 border-t border-slate-200">
        <div className="flex items-center justify-between mb-2">
           {/* Made bold as requested */}
           <label className="text-xs font-bold text-slate-600 flex items-center gap-1 uppercase tracking-wider">
             <Zap size={12} className="text-amber-500" /> Speed
           </label>
           <span className="text-xs font-mono font-bold text-slate-500">{speed === 50 ? 'Normal' : speed > 50 ? 'Fast' : 'Slow'} ({speed}%)</span>
        </div>
        <div className="relative h-6 flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            value={speed}
            onChange={(e) => onSpeedChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            style={{
               background: `linear-gradient(to right, #f59e0b ${speed}%, #e2e8f0 ${speed}%)`
            }}
          />
          {/* Center Tick */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-slate-400 pointer-events-none opacity-50"></div>
        </div>
        {/* Made bold as requested */}
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 uppercase font-bold">
          <span>Slow</span>
          <span>Normal</span>
          <span>Fast</span>
        </div>
      </div>
    </div>
  );
};

const getColor = (emotion: string) => {
  switch (emotion) {
    case 'Happy': return '#22c55e'; // Green
    case 'Sad': return '#3b82f6';   // Blue
    case 'Angry': return '#ef4444'; // Red
    case 'Fearful': return '#a855f7'; // Purple
    case 'Excited': return '#f59e0b'; // Amber
    case 'Crying': return '#06b6d4'; // Cyan
    default: return '#64748b';
  }
};

export default EmotionEqualizer;