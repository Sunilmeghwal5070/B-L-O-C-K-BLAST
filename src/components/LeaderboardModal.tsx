import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Trophy, X, Medal, Star, Shield } from 'lucide-react';
import { sound } from '../utils/soundEngine';
import { cn } from '../utils/cn';
import { safeStorage } from '../utils/safeStorage';

type Props = {
  onClose: () => void;
};

export function LeaderboardModal({ onClose }: Props) {
  const sessionUsername = safeStorage.getItem('block_blast_username') || '@guest';
  const highScore = parseInt(safeStorage.getItem('block_blast_high_score') || '0', 10);
  const [liveUsers, setLiveUsers] = useState<{username: string, score: number}[]>([]);

  useEffect(() => {
    let unsubscribe: () => void;
    import('../utils/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ collection, query, orderBy, limit, onSnapshot }) => {
         const q = query(collection(db, "users"), orderBy("score", "desc"), limit(50));
         unsubscribe = onSnapshot(q, (snapshot) => {
              const users: {username: string, score: number}[] = [];
              snapshot.forEach((doc) => {
                  const data = doc.data();
                  const bestScore = typeof data.highScore === 'number' ? data.highScore : (typeof data.score === 'number' ? data.score : 0);
                  if (data.username && bestScore > 0) {
                      users.push({ username: data.username, score: bestScore });
                  }
              });
              setLiveUsers(users);
         }, (error) => {
              console.warn("Leaderboard sync error ignored:", error);
         });
      });
    });
    return () => {
       if (unsubscribe) unsubscribe();
    };
  }, []);

  const leaderboardText = useMemo(() => {
    const entries: { username: string; score: number; isUser: boolean; isLive: boolean }[] = [];
    
    // Add current session user if not currently present in the downloaded liveUsers list
    const sessionUserExistsInLive = liveUsers.some(lu => lu.username === sessionUsername);
    if (!sessionUserExistsInLive && highScore >= 0) {
      entries.push({
        username: sessionUsername,
        score: highScore,
        isUser: true,
        isLive: true
      });
    }

    liveUsers.forEach(lu => {
       const isMe = lu.username === sessionUsername;
       const finalScore = isMe ? Math.max(lu.score, highScore) : lu.score;
       entries.push({
          username: lu.username,
          score: finalScore,
          isUser: isMe,
          isLive: true
       });
    });

    entries.sort((a, b) => b.score - a.score);

    return entries.map((e, index) => ({
      ...e,
      rank: index + 1
    }));
  }, [highScore, sessionUsername, liveUsers]);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Star, color: 'text-cyan-300', bg: 'bg-cyan-500/20 border-cyan-400' }; // 1 Diamond
    if (rank === 2 || rank === 3) return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-400' }; // 2 Gold
    if (rank >= 4 && rank <= 6) return { icon: Medal, color: 'text-gray-300', bg: 'bg-gray-400/20 border-gray-300' }; // 3 Silver
    return null;
  };

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6">
       <motion.div 
         initial={{ scale: 0.9, opacity: 0, y: 20 }}
         animate={{ scale: 1, opacity: 1, y: 0 }}
         exit={{ scale: 0.9, opacity: 0, y: 20 }}
         className="bg-[#1C2759] border-2 border-[#2A3771] rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl relative max-h-[80vh]"
       >
          <div className="bg-[#141b3d] p-4 flex justify-between items-center border-b border-white/10 relative overflow-hidden">
             <div className="absolute -left-4 top-0 opacity-10">
               <Trophy className="w-24 h-24 text-yellow-400" />
             </div>
             <h2 className="text-2xl font-black text-white px-2 tracking-wide uppercase flex items-center gap-2 relative z-10">
               <Trophy className="w-6 h-6 text-yellow-400" />
               Leaderboard
             </h2>
             <button 
                onClick={() => {
                   sound.playClick();
                   onClose();
                }}
                className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition cursor-pointer relative z-10"
             >
               <X className="w-6 h-6 text-white"/>
             </button>
          </div>

          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-2 relative">
            {leaderboardText.map((entry) => {
              const badge = getRankBadge(entry.rank);
              const BadgeIcon = badge?.icon;
              
              return (
                <div 
                  key={entry.username} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border relative overflow-hidden shrink-0",
                    entry.isUser ? "bg-white/10 border-blue-400/50" : "bg-[#141b3d] border-transparent"
                  )}
                >
                  {entry.isUser && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/10 pointer-events-none" />
                  )}
                  <div className="flex items-center gap-3 relative z-10">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm border-2",
                      badge ? badge.bg : "bg-[#1C2759] border-[#2A3771] text-gray-400"
                    )}>
                      {BadgeIcon ? <BadgeIcon className={cn("w-4 h-4", badge.color)} /> : entry.rank}
                    </div>
                    <div>
                      <div className={cn(
                        "font-bold text-sm leading-tight flex items-center gap-1.5",
                        entry.isUser ? "text-blue-300" : "text-white"
                      )}>
                        {entry.username} {entry.isUser && "(You)"}
                        {entry.isLive && <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,1)]" title="Online now"></span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-1.5 relative z-10">
                    <span className="font-black text-lg text-yellow-400">{entry.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
       </motion.div>
    </div>
  );
}
