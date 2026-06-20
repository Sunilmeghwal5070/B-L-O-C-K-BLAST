import React from 'react';
import { motion } from 'motion/react';
import { Crown, Play } from 'lucide-react';
import { sound } from '../utils/soundEngine';

type Props = {
  score: number;
  isBest: boolean;
  onRestart: () => void;
};

export const GameOverModal: React.FC<Props> = ({ score, isBest, onRestart }) => {
  return (
    <div className="absolute inset-0 bg-[#593CA5]/95 z-50 flex items-center justify-center p-6 flex-col">
      <motion.div 
        initial={{ opacity: 0, scale: 0.5, y: -50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.6 }}
        className="flex flex-col items-center"
      >
        <Crown className="w-20 h-20 text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] mb-2" />
        <h1 className="text-5xl font-black text-yellow-400 drop-shadow-md mb-8">
          {isBest ? 'Best Score!' : 'Game Over'}
        </h1>
        
        <p className="text-purple-300 font-semibold uppercase tracking-widest text-sm mb-1">Score</p>
        <div className="text-8xl font-black text-white drop-shadow-xl mb-12">
          {score}
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            sound.playClick();
            onRestart();
          }}
          className="bg-gradient-to-b from-yellow-400 to-yellow-600 w-48 py-4 rounded-full font-bold text-2xl shadow-[0_6px_0_1px_#854d0e,0_10px_20px_rgba(0,0,0,0.4)] border border-yellow-300 text-white flex justify-center items-center active:translate-y-2 active:shadow-[0_0_0_1px_#854d0e,0_2px_4px_rgba(0,0,0,0.4)] transition-all"
        >
          <Play className="w-8 h-8 fill-current ml-2" />
        </motion.button>
      </motion.div>
    </div>
  );
};
