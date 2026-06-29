import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Volume2, VolumeX, Music, Smartphone, Palette, Gem, Lock } from 'lucide-react';
import { sound } from '../utils/soundEngine';
import { cn } from '../utils/cn';
import { safeStorage } from '../utils/safeStorage';

type Props = {
  onClose: () => void;
};

const THEMES = [
  { type: 'theme', id: 'default', name: 'Default Skin', cost: 0, color: 'bg-indigo-900 text-white' },
  { type: 'theme', id: 'neon', name: 'Neon Arcade', cost: 50, color: 'bg-fuchsia-900 text-white' },
  { type: 'theme', id: 'nature', name: 'Forest Wood', cost: 100, color: 'bg-emerald-900 text-white' },
  { type: 'theme', id: 'royal', name: 'Royal Gold', cost: 150, color: 'bg-amber-900 text-white' },
];

const BLOCK_STYLES = [
  { id: 'default', name: 'Classic 3D', cost: 0, color: 'bg-blue-600 outline-none' },
  { id: 'flat', name: 'Modern Flat', cost: 30, color: 'bg-sky-500 rounded-sm' },
  { id: 'jewel', name: 'Shiny Jewel', cost: 80, color: 'bg-purple-500 rounded-full' },
  { id: 'glow', name: 'Aura Glow', cost: 120, color: 'bg-red-500 shadow-[0_0_15px_currentColor]' },
];

export const SettingsModal: React.FC<Props> = ({ onClose }) => {
  const [sfx, setSfx] = React.useState(sound.soundEnabled);
  const [vibration, setVibration] = React.useState(sound.vibrationEnabled);
  const [bgm, setBgm] = React.useState(sound.bgmEnabled);
  
  const [coins, setCoins] = useState(() => {
    return parseInt(safeStorage.getItem('block_blast_coins') || '0', 10);
  });

  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(() => {
    const saved = safeStorage.getItem('block_blast_unlocked_themes');
    return saved ? JSON.parse(saved) : ['default'];
  });

  const [currentTheme, setCurrentTheme] = useState(() => {
    return safeStorage.getItem('block_blast_theme') || 'default';
  });
  
  const [unlockedBlockStyles, setUnlockedBlockStyles] = useState<string[]>(() => {
    const saved = safeStorage.getItem('block_blast_unlocked_bstyles');
    return saved ? JSON.parse(saved) : ['default'];
  });

  const [currentBlockStyle, setCurrentBlockStyle] = useState(() => {
    return safeStorage.getItem('block_blast_bstyle') || 'default';
  });
  
  const toggleSfx = () => {
    sound.setSoundEnabled(!sound.soundEnabled);
    setSfx(sound.soundEnabled);
    if (sound.soundEnabled) sound.playClick();
  };

  const toggleVibration = () => {
    sound.setVibrationEnabled(!sound.vibrationEnabled);
    setVibration(sound.vibrationEnabled);
    if (sound.vibrationEnabled) {
       sound.vibrate(50);
       if(sound.soundEnabled) sound.playClick();
    }
  };

  const toggleBgm = () => {
    sound.setBGMEnabled(!sound.bgmEnabled);
    setBgm(sound.bgmEnabled);
    if (sound.soundEnabled) sound.playClick();
  };

  const updateBodyClasses = (themeId: string, styleId: string) => {
     let cls = '';
     if (themeId !== 'default') cls += `${themeId}-theme `;
     if (styleId !== 'default') cls += `block-style-${styleId}`;
     document.body.className = cls.trim();
  };

  const handleThemeSelect = (themeId: string, cost: number) => {
    sound.playClick();
    if (unlockedThemes.includes(themeId)) {
        setCurrentTheme(themeId);
        safeStorage.setItem('block_blast_theme', themeId);
        updateBodyClasses(themeId, currentBlockStyle);
    } else if (coins >= cost) {
        const newCoins = coins - cost;
        setCoins(newCoins);
        safeStorage.setItem('block_blast_coins', newCoins.toString());
        const newUnlocked = [...unlockedThemes, themeId];
        setUnlockedThemes(newUnlocked);
        safeStorage.setItem('block_blast_unlocked_themes', JSON.stringify(newUnlocked));
        
        setCurrentTheme(themeId);
        safeStorage.setItem('block_blast_theme', themeId);
        updateBodyClasses(themeId, currentBlockStyle);
    }
  };

  const handleStyleSelect = (styleId: string, cost: number) => {
    sound.playClick();
    if (unlockedBlockStyles.includes(styleId)) {
        setCurrentBlockStyle(styleId);
        safeStorage.setItem('block_blast_bstyle', styleId);
        updateBodyClasses(currentTheme, styleId);
    } else if (coins >= cost) {
        const newCoins = coins - cost;
        setCoins(newCoins);
        safeStorage.setItem('block_blast_coins', newCoins.toString());
        const newUnlocked = [...unlockedBlockStyles, styleId];
        setUnlockedBlockStyles(newUnlocked);
        safeStorage.setItem('block_blast_unlocked_bstyles', JSON.stringify(newUnlocked));
        
        setCurrentBlockStyle(styleId);
        safeStorage.setItem('block_blast_bstyle', styleId);
        updateBodyClasses(currentTheme, styleId);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="bg-[#2A418B] rounded-3xl w-full max-w-sm border border-[#3A51A6] shadow-2xl overflow-hidden"
      >
        <div className="bg-[#354EA0] py-4 px-6 relative flex justify-between items-center border-b border-[#4361C2]">
          <div className="flex items-center gap-1">
             <Gem className="w-5 h-5 text-fuchsia-400 drop-shadow-md" />
             <span className="text-lg font-bold text-fuchsia-400 drop-shadow-md">{coins}</span>
          </div>
          <h2 className="text-2xl font-bold text-white absolute left-1/2 transform -translate-x-1/2">Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full active:scale-95 transition-all">
            <X className="w-7 h-7 text-white/70" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-around items-center py-4 border-b border-white/10 mb-2 text-white shrink-0">
             <div className={`flex flex-col items-center gap-2 cursor-pointer transition-all ${!sfx && 'opacity-60'}`} onClick={toggleSfx} role="button">
                {sfx ? <Volume2 className="w-8 h-8"/> : <VolumeX className="w-8 h-8 text-red-400" />}
                <span className="text-sm font-semibold">Sound</span>
             </div>
             <div className={`flex flex-col items-center gap-2 cursor-pointer transition-all relative ${!bgm && 'opacity-60'}`} onClick={toggleBgm} role="button">
                <Music className="w-8 h-8"/>
                {!bgm && <div className="absolute top-1 rotate-45 w-[36px] h-[3px] bg-red-500 rounded"></div>}
                <span className="text-sm font-semibold">BGM</span>
             </div>
             <div className={`flex flex-col items-center gap-2 cursor-pointer transition-all relative ${!vibration && 'opacity-60'}`} onClick={toggleVibration} role="button">
                <Smartphone className="w-8 h-8"/>
                {!vibration && <div className="absolute top-1 rotate-45 w-[36px] h-[3px] bg-red-500 rounded"></div>}
                <span className="text-sm font-semibold">Vibration</span>
             </div>
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2 text-white/80 font-semibold mb-1">
                <Palette className="w-5 h-5" />
                <span>Background Themes</span>
             </div>
             
             {THEMES.map(theme => {
                const isUnlocked = unlockedThemes.includes(theme.id);
                const isSelected = currentTheme === theme.id;
                
                return (
                   <button 
                     key={theme.id}
                     className={cn(
                        "w-full py-2.5 px-4 rounded-xl font-bold flex justify-between items-center transition-all",
                        theme.color,
                        isSelected ? "ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" : "opacity-80 active:scale-95"
                     )}
                     onClick={() => handleThemeSelect(theme.id, theme.cost)}
                   >
                      <span className="text-base">{theme.name}</span>
                      {isSelected ? (
                         <span className="text-[10px] bg-white text-black px-2 py-1 rounded-full uppercase tracking-wider">Active</span>
                      ) : isUnlocked ? (
                         <span className="text-[10px] bg-black/30 px-2 py-1 rounded-full text-white/80 uppercase tracking-wider">Select</span>
                      ) : (
                         <div className="flex gap-1 items-center bg-black/40 px-2 py-1 rounded-full">
                            <Lock className="w-3 h-3 text-red-300" />
                            <span className="text-xs text-red-200">{theme.cost}</span>
                            <Gem className="w-3 h-3 text-fuchsia-400" />
                         </div>
                      )}
                   </button>
                )
             })}
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center gap-2 text-white/80 font-semibold mb-1 mt-2">
                <span>Block Styles</span>
             </div>
             
             {BLOCK_STYLES.map(style => {
                const isUnlocked = unlockedBlockStyles.includes(style.id);
                const isSelected = currentBlockStyle === style.id;
                
                return (
                   <button 
                     key={style.id}
                     className={cn(
                        "w-full py-2.5 px-4 rounded-xl font-bold flex justify-between items-center transition-all text-white",
                        style.color,
                        isSelected ? "ring-2 ring-white shadow-[0_0_15px_rgba(255,255,255,0.4)]" : "opacity-80 active:scale-95"
                     )}
                     onClick={() => handleStyleSelect(style.id, style.cost)}
                   >
                      <span className="text-base drop-shadow-md">{style.name}</span>
                      {isSelected ? (
                         <span className="text-[10px] bg-white text-black px-2 py-1 rounded-full uppercase tracking-wider">Active</span>
                      ) : isUnlocked ? (
                         <span className="text-[10px] bg-black/30 px-2 py-1 rounded-full text-white/80 uppercase tracking-wider">Select</span>
                      ) : (
                         <div className="flex gap-1 items-center bg-black/40 px-2 py-1 rounded-full">
                            <Lock className="w-3 h-3 text-red-300" />
                            <span className="text-xs text-red-200">{style.cost}</span>
                            <Gem className="w-3 h-3 text-fuchsia-400" />
                         </div>
                      )}
                   </button>
                )
             })}
          </div>

          <button onClick={() => { sound.playClick(); onClose(); }} className="bg-gradient-to-b from-blue-400 to-blue-600 w-full py-3 rounded-xl font-bold shadow-[0_4px_0_1px_#1e3a8a] active:shadow-none active:translate-y-1 transition-all text-white flex justify-center items-center gap-2 mt-4 shrink-0">
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};
