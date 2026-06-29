import React from 'react';
import { motion } from 'motion/react';

type Props = {
  onAccept: () => void;
};

export const WelcomeScreen: React.FC<Props> = ({ onAccept }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-3xl p-8 max-w-sm w-full shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-indigo-400 flex flex-col items-center text-center relative"
      >
        <div className="absolute -top-16 bg-yellow-400 w-32 h-32 rounded-full shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.2)] flex items-center justify-center p-2 text-6xl">
           😘
        </div>
        
        <h2 className="text-2xl font-bold mt-16 mb-2">Welcome to Block Blast!</h2>
        <p className="text-indigo-100 mb-8 font-medium">
          Please read and accept our <br/><span className="text-cyan-300 font-bold">Terms of Use</span> and <span className="text-cyan-300 font-bold">Privacy Policy</span>.
        </p>
        
        <button
          onClick={onAccept}
          className="bg-gradient-to-b from-green-400 to-green-600 w-full py-4 rounded-xl font-bold text-2xl shadow-[0_4px_0_1px_#14532d] active:shadow-none active:translate-y-1 transition-all"
        >
          Accept
        </button>
      </motion.div>
    </div>
  );
};
