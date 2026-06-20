import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { sound } from '../utils/soundEngine';
import { cn } from '../utils/cn';
import { safeStorage } from '../utils/safeStorage';

type Props = {
  onComplete: (username: string) => void;
};

export const UsernameScreen: React.FC<Props> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'error' | 'success'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let val = username.trim();
    if (!val) return;
    
    if (!val.startsWith('@')) {
      val = '@' + val;
      setUsername(val);
    }

    if (val.length < 4) {
      setStatus('error');
      setErrorMsg('Username too short');
      sound.playError?.();
      return;
    }

    sound.playClick();
    setStatus('checking');
    
    setTimeout(() => {
      // simulate check
      const takenUsernames = ['@rahul_1', '@anil_34', '@pro_gamer', '@admin'];
      if (takenUsernames.includes(val.toLowerCase())) {
        setStatus('error');
        setErrorMsg('Username already taken. Choose another.');
        sound.playError?.();
      } else {
        setStatus('success');
        safeStorage.setItem('block_blast_username', val);
        sound.playClear?.();
        setTimeout(() => onComplete(val), 1000);
      }
    }, 1200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-[#0f172a] flex flex-col items-center justify-center p-6 text-white z-50 overflow-hidden"
    >
      <div className="absolute inset-0 pattern-dots opacity-10 pointer-events-none" />
      
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-sm bg-[#1e293b] p-8 rounded-3xl shadow-2xl border border-white/5 relative z-10"
      >
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-400">
          <User className="w-8 h-8" />
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2">Choose Username</h2>
        <p className="text-sm text-gray-400 text-center mb-8">Creates your unique profile for the global leaderboard</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setStatus('idle');
              }}
              placeholder="@your_name"
              disabled={status === 'checking' || status === 'success'}
              className={cn(
                "w-full bg-black/30 border-2 rounded-xl px-4 py-3 outline-none transition-all placeholder:text-gray-600 font-mono text-lg",
                status === 'error' ? "border-red-500/50 focus:border-red-500" : 
                status === 'success' ? "border-green-500/50 text-green-400" :
                "border-white/10 focus:border-blue-500"
              )}
            />
            {status === 'checking' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}
          </div>
          
          {status === 'error' && (
             <p className="text-red-400 text-xs text-center">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={status === 'checking' || status === 'success' || !username}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-xl transition-colors mt-4"
          >
            {status === 'checking' ? 'Checking...' : status === 'success' ? 'Confirmed!' : 'Continue'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
