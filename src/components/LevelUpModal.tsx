import React from 'react';
import { motion } from 'motion/react';
import { Gem, LockOpen, Check, Star } from 'lucide-react';
import { sound } from '../utils/soundEngine';

type Props = {
  data: { level: number; coins: number; unlock?: string };
  onClose: () => void;
};

export const LevelUpModal: React.FC<Props> = ({ data, onClose }) => {
  React.useEffect(() => {
    sound.playClear();
  }, []);

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-gradient-to-b from-[#2A418B] to-[#1C2759] rounded-3xl w-full max-w-sm border border-[#4361C2] shadow-[0_20px_50px_rgba(0,0,0,0.7)] overflow-hidden text-center"
      >
        <div className="px-6 py-8 relative">
           <motion.div 
             initial={{ scale: 0 }}
             animate={{ scale: 1, rotate: 360 }}
             transition={{ type: 'spring', damping: 10, delay: 0.2 }}
             className="w-24 h-24 mx-auto bg-gradient-to-tr from-yellow-400 to-amber-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.5)] mb-6 border-4 border-[#1C2759]"
           >
              <Star className="w-12 h-12 text-white fill-white" />
           </motion.div>
           
           <h2 className="text-4xl font-black text-white drop-shadow-md mb-2">LEVEL {data.level}</h2>
           <p className="text-blue-200 font-bold text-lg mb-6">Level Completed!</p>

           <div className="bg-white/10 rounded-2xl p-4 mb-6 border border-white/10">
              <p className="text-sm text-blue-200 mb-2 uppercase tracking-wide font-bold">Rewards</p>
              <div className="flex items-center justify-center gap-2 mb-2">
                 <span className="text-2xl font-bold text-fuchsia-400">+{data.coins}</span>
                 <Gem className="w-6 h-6 text-fuchsia-400 drop-shadow-md" />
              </div>
              {data.unlock && (
                 <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-blue-300 mb-2 uppercase tracking-wide font-bold">Unlocked Feature</p>
                    <div className="flex items-center justify-center gap-2 text-green-400">
                       <LockOpen className="w-5 h-5" />
                       <span className="font-bold">{data.unlock}</span>
                    </div>
                 </div>
              )}
           </div>

           <button 
             onClick={() => { sound.playClick(); onClose(); }} 
             className="bg-gradient-to-b from-blue-400 to-blue-600 hover:from-blue-300 hover:to-blue-500 w-full py-4 rounded-xl font-bold text-xl shadow-[0_4px_0_1px_#1e3a8a] active:shadow-none active:translate-y-1 transition-all text-white flex justify-center items-center gap-2"
           >
             <Check className="w-6 h-6" /> Awesome!
           </button>
        </div>
      </motion.div>
    </div>
  );
};
