import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Play, Settings, ShoppingCart, Gift, User, Info, ListTree, PlaySquare, X, Trophy, Users } from 'lucide-react';
import { sound } from '../utils/soundEngine';
import { LeaderboardModal } from './LeaderboardModal';
import { FriendsModal } from './FriendsModal';
import { safeStorage } from '../utils/safeStorage';

type Props = {
  onStart: () => void;
  onOpenSettings?: () => void;
};

export const MenuScreen: React.FC<Props> = ({ onStart, onOpenSettings }) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const [coins, setCoins] = useState(() => parseInt(safeStorage.getItem('block_blast_coins') || '0', 10));
  const [lastClaimed, setLastClaimed] = useState(() => safeStorage.getItem('block_blast_last_claim') || '');
  const [hasNeonTheme, setHasNeonTheme] = useState(() => safeStorage.getItem('block_blast_theme') === 'neon');
  const [hasNoAds, setHasNoAds] = useState(() => safeStorage.getItem('block_blast_no_ads') === 'true');
  const sessionUsername = safeStorage.getItem('block_blast_username') || '@guest';

  const today = new Date().toDateString();
  const canClaim = lastClaimed !== today;

  const handleMenuClick = (action: string) => {
    sound.playClick();
    if (action === 'Settings') {
       if (onOpenSettings) onOpenSettings();
    } else {
       setActiveModal(action);
    }
  };

  const handleClaim = () => {
     if (canClaim) {
        sound.playClear();
        const newCoins = coins + 50;
        setCoins(newCoins);
        setLastClaimed(today);
        safeStorage.setItem('block_blast_coins', String(newCoins));
        safeStorage.setItem('block_blast_last_claim', today);
     }
  };

  const buyNeonTheme = () => {
     if (hasNeonTheme) {
        sound.playPlace();
        if (safeStorage.getItem('block_blast_theme') === 'neon') {
           safeStorage.setItem('block_blast_theme', 'default');
           document.body.classList.remove('neon-theme');
        } else {
           safeStorage.setItem('block_blast_theme', 'neon');
           document.body.classList.add('neon-theme');
        }
        return;
     }

     if (coins >= 200) {
        sound.playPlace();
        const newCoins = coins - 200;
        setCoins(newCoins);
        setHasNeonTheme(true);
        safeStorage.setItem('block_blast_coins', String(newCoins));
        safeStorage.setItem('block_blast_theme', 'neon');
        document.body.classList.add('neon-theme');
     } else {
        sound.playClick();
     }
  };

  const buyNoAds = () => {
      sound.playPlace();
      setHasNoAds(true);
      safeStorage.setItem('block_blast_no_ads', 'true');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-between p-6 relative w-full h-full overflow-y-auto"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 transform -translate-x-1/2 translate-y-1/2 pointer-events-none"></div>
      
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-sm mt-8">
          <motion.div
            initial={{ scale: 0.8, y: -50 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="flex flex-col items-center mb-10 relative z-10"
          >
            <Crown className="w-16 h-16 text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]" />
            <h1 className="text-6xl font-black tracking-tighter flex items-end">
              <span className="text-transparent bg-clip-text bg-gradient-to-t from-orange-500 to-yellow-400">B</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-t from-blue-500 to-cyan-400">L</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-t from-red-500 to-pink-500">O</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-t from-yellow-400 to-orange-400">C</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-t from-purple-500 to-purple-400">K</span>
            </h1>
            <h1 className="text-6xl font-black text-cyan-400 tracking-tight italic -mt-2 drop-shadow-lg">
              BLAST
            </h1>
            <p className="text-blue-200 mt-2 tracking-widest text-sm font-semibold uppercase">Adventure Master</p>
          </motion.div>

          {/* Primary Actions */}
          <div className="w-full flex flex-col gap-3 relative z-10 mb-8">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  sound.init(); 
                  sound.playClick();
                  onStart();
                }}
                className="bg-gradient-to-b from-green-400 to-green-600 w-full py-4 rounded-full font-bold text-2xl shadow-[0_6px_0_1px_#14532d,0_10px_20px_rgba(0,0,0,0.4)] border border-green-300 text-white flex justify-center items-center gap-2 active:translate-y-2 active:shadow-[0_0_0_1px_#14532d,0_2px_4px_rgba(0,0,0,0.4)] transition-all"
              >
                <Play className="w-6 h-6 fill-current"/> PLAY
              </motion.button>
          </div>

          {/* Grid Menu Actions */}
          <div className="flex flex-wrap justify-center gap-3 w-full relative z-10 pb-4">
              {[
                { icon: Trophy, label: 'Leaders', color: 'from-yellow-400 to-orange-500' },
                { icon: Users, label: 'Friends', color: 'from-indigo-400 to-blue-600' },
                { icon: ShoppingCart, label: 'Store', color: 'from-purple-400 to-purple-600' },
                { icon: Gift, label: 'Rewards', color: 'from-pink-400 to-pink-600' },
                { icon: User, label: 'Profile', color: 'from-cyan-400 to-cyan-600' },
                { icon: Settings, label: 'Settings', color: 'from-gray-500 to-gray-700' },
              ].map((btn, i) => (
                 <motion.div 
                   key={i}
                   whileHover={{ scale: 1.1 }}
                   whileTap={{ scale: 0.9 }}
                   className={`bg-gradient-to-br ${btn.color} rounded-2xl flex flex-col items-center justify-center p-3 shadow-lg border border-white/20 active:translate-y-1 transition-all cursor-pointer w-[30%]`}
                   onClick={() => handleMenuClick(btn.label)}
                 >
                    <btn.icon className="w-6 h-6 text-white mb-1 drop-shadow-md" />
                    <span className="text-[10px] sm:text-xs font-bold text-white drop-shadow-md">{btn.label}</span>
                 </motion.div>
              ))}
          </div>
      </div>

      <AnimatePresence>
        {activeModal === 'Leaders' && (
          <LeaderboardModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal === 'Friends' && (
          <FriendsModal onClose={() => setActiveModal(null)} />
        )}
        {activeModal && activeModal !== 'Leaders' && activeModal !== 'Friends' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-[#1C2759] border-2 border-[#2A3771] rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative"
             >
                <div className="bg-[#141b3d] p-4 flex justify-between items-center border-b border-white/10">
                   <h2 className="text-2xl font-black text-white px-2 tracking-wide uppercase">{activeModal}</h2>
                   <button 
                      onClick={() => {
                         sound.playClick();
                         setActiveModal(null);
                      }}
                      className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition cursor-pointer"
                   >
                     <X className="w-6 h-6 text-white"/>
                   </button>
                </div>

                <div className="p-6 overflow-y-auto min-h-[250px] max-h-[60vh] text-center flex flex-col items-center">
                   {activeModal === 'Store' && (
                     <div className="flex flex-col gap-4 w-full">
                        <div className="bg-[#151c3d] p-4 rounded-xl border border-[#2A3771] flex items-center justify-between">
                           <div className="flex items-center gap-3 text-left">
                             <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-indigo-500 rounded flex items-center justify-center border-2 border-white/20"><Crown className="w-6 h-6 text-yellow-300"/></div>
                             <div>
                               <div className="font-bold text-white">Neon Grid Theme</div>
                               <div className="text-xs text-blue-200">Unlock retro skin</div>
                             </div>
                           </div>
                           <button 
                              className={`px-3 py-1.5 rounded-lg text-sm text-white font-bold active:scale-95 transition-colors ${hasNeonTheme ? 'bg-indigo-500' : 'bg-blue-500 hover:bg-blue-600'}`}
                              onClick={buyNeonTheme}
                           >
                              {hasNeonTheme ? 'Owned / Toggle' : '200 🪙'}
                           </button>
                        </div>
                        <div className="bg-[#151c3d] p-4 rounded-xl border border-[#2A3771] flex items-center justify-between">
                           <div className="flex items-center gap-3 text-left">
                             <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded flex items-center justify-center border-2 border-white/20"><Gift className="w-6 h-6 text-white"/></div>
                             <div>
                               <div className="font-bold text-white">No Ads Pack</div>
                               <div className="text-xs text-blue-200">Unlimited play</div>
                             </div>
                           </div>
                           <button 
                             className={`px-3 py-1.5 rounded-lg text-sm text-white font-bold active:scale-95 transition-colors ${hasNoAds ? 'bg-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'}`}
                             onClick={buyNoAds}
                             disabled={hasNoAds}
                           >
                             {hasNoAds ? 'Owned' : '$1.99'}
                           </button>
                        </div>
                     </div>
                   )}

                   {activeModal === 'Rewards' && (
                     <div className="flex flex-col items-center gap-4 w-full">
                        <motion.div 
                          animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                          transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                          className="w-24 h-24 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.4)] border-4 border-white mb-2"
                        >
                           <Gift className="w-12 h-12 text-white" />
                        </motion.div>
                        <h3 className="text-2xl text-white font-bold">Daily Reward!</h3>
                        <p className="text-blue-200 text-sm">Come back every day for coins and bonuses.</p>
                        <button 
                          className={`w-full py-3 rounded-xl font-bold text-white shadow-lg mt-4 active:scale-95 transition-all ${canClaim ? 'bg-gradient-to-b from-green-400 to-green-600' : 'bg-gray-600 opacity-50 cursor-not-allowed'}`}
                          onClick={handleClaim}
                          disabled={!canClaim}
                        >
                           {canClaim ? 'Claim 50 🪙' : 'Come back tomorrow!'}
                        </button>
                     </div>
                   )}

                   {activeModal === 'Profile' && (
                     <div className="flex flex-col items-center gap-4 w-full">
                        <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center border-4 border-[#2A3771] shadow-lg relative">
                           <User className="w-10 h-10 text-white" />
                           <div className="absolute -bottom-2 -right-2 bg-yellow-400 rounded-full p-1 border-2 border-[#1C2759]">
                              <Crown className="w-4 h-4 text-[#1C2759]" />
                           </div>
                        </div>
                        <h3 className="text-xl text-white font-bold">{sessionUsername}</h3>
                        
                        <div className="w-full grid grid-cols-2 gap-3 mt-4">
                           <div className="bg-[#141b3d] p-3 rounded-xl border border-[#2A3771] flex flex-col items-center justify-center relative overflow-hidden">
                              <div className="absolute right-[-10px] top-[-10px] opacity-10">
                                 <Crown className="w-16 h-16 text-yellow-400" />
                              </div>
                              <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">High Score</span>
                              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600">{safeStorage.getItem('block_blast_high_score') || 0}</span>
                           </div>
                           <div className="bg-[#141b3d] p-3 rounded-xl border border-[#2A3771] flex flex-col items-center justify-center relative overflow-hidden">
                              <div className="absolute right-[-10px] top-[-10px] opacity-10">
                                 <Crown className="w-16 h-16 text-yellow-400" />
                              </div>
                              <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Total Coins</span>
                              <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{coins}</span>
                           </div>
                        </div>
                     </div>
                   )}

                   {activeModal === 'About' && (
                     <div className="flex flex-col items-center text-center gap-4 w-full">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-3xl flex items-center justify-center shadow-lg border-2 border-white/20 mb-2">
                           <Crown className="w-10 h-10 text-yellow-300 drop-shadow-md" />
                        </div>
                        <h3 className="text-2xl text-white font-black tracking-tight">BLOCK BLAST</h3>
                        <p className="text-blue-300 text-sm font-bold uppercase tracking-widest -mt-2">Version 1.0.0</p>
                        <p className="text-blue-100 text-sm mt-2 leading-relaxed">
                          Place blocks to clear lines in this highly addictive spatial puzzle game.
                        </p>
                        <p className="text-green-300 font-bold mt-2">Developed by Sunil Meghwal</p>
                        <p className="text-blue-400 text-xs mt-2">© 2026 Adventure Master</p>
                     </div>
                   )}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};


