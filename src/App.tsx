import React, { useState, useEffect } from 'react';
import { GameState } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { UsernameScreen } from './components/UsernameScreen';
import { MenuScreen } from './components/MenuScreen';
import { GameScreen } from './components/GameScreen';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { DuelScreen } from './components/DuelScreen';
import { sound } from './utils/soundEngine';
import { AnimatePresence, motion } from 'motion/react';
import { safeStorage } from './utils/safeStorage';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (!safeStorage.getItem('block_blast_welcomed')) return 'WELCOME';
    if (!safeStorage.getItem('block_blast_username')) return 'USERNAME';
    if (safeStorage.getItem('block_blast_save')) return 'PLAYING';
    return 'MENU';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [isBestScore, setIsBestScore] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<any>(null);

  useEffect(() => {
     const handleFirstInteraction = () => {
        sound.unlockAudio();
        document.removeEventListener('pointerdown', handleFirstInteraction);
        document.removeEventListener('keydown', handleFirstInteraction);
     };
     document.addEventListener('pointerdown', handleFirstInteraction);
     document.addEventListener('keydown', handleFirstInteraction);

     const handleVisibilityChange = () => {
        if (!document.hidden) {
           sound.unlockAudio();
        }
     };
     document.addEventListener('visibilitychange', handleVisibilityChange);

     let cls = '';
     const theme = safeStorage.getItem('block_blast_theme');
     if (theme && theme !== 'default') {
         cls += `${theme}-theme `;
     }
     const bstyle = safeStorage.getItem('block_blast_bstyle');
     if (bstyle && bstyle !== 'default') {
         cls += `block-style-${bstyle}`;
     }
     document.body.className = cls.trim();

     const username = safeStorage.getItem('block_blast_username');
     if (username) {
        import('./utils/firebase').then(({ initAuth, db }) => {
           initAuth().then((user) => {
               if (user) {
                   import('firebase/firestore').then(({ doc, setDoc }) => {
                       const score = parseInt(safeStorage.getItem('block_blast_high_score') || '0', 10);
                       setDoc(doc(db, "users", user.uid), {
                           username,
                           username_lower: username.toLowerCase(),
                           score,
                           isOnline: true,
                           lastActive: new Date().toISOString(),
                           updatedAt: new Date().toISOString()
                       }, { merge: true });
                       const interval = setInterval(() => {
                           setDoc(doc(db, "users", user.uid), {
                               isOnline: true,
                               lastActive: new Date().toISOString()
                           }, { merge: true });
                       }, 12000);
                       (window as any).__presenceInterval = interval;
                   });
               }
           });
        });
     }
  }, []);

  useEffect(() => {
    let unsubMatches: (() => void) | null = null;
    import('./utils/firebase').then(({ auth, db }) => {
      auth.onAuthStateChanged((user) => {
        if (!user) return;
        import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
          const q = query(
            collection(db, 'matches'),
            where('users', 'array-contains', user.uid)
          );
          unsubMatches = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              const matchId = change.doc.id;

              if (change.type === 'added' || change.type === 'modified') {
                if (data.status === 'pending') {
                  if (data.challengeeId === user.uid) {
                    setIncomingChallenge({ id: matchId, ...data });
                  }
                } else if (data.status === 'accepted') {
                  setActiveMatchId(matchId);
                  setGameState('DUEL');
                  setIncomingChallenge(null);
                }
              } else if (change.type === 'removed') {
                setIncomingChallenge(prev => prev?.id === matchId ? null : prev);
                setActiveMatchId(prev => prev === matchId ? null : prev);
              }
            });
          }, (error) => {
            console.warn("Match snapshot error:", error);
          });
        });
      });
    });

    return () => {
      if (unsubMatches) unsubMatches();
    };
  }, []);

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge) return;
    sound.init();
    sound.playClick?.();
    const { id } = incomingChallenge;
    import('./utils/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, updateDoc }) => {
        updateDoc(doc(db, 'matches', id), {
          status: 'accepted',
          updatedAt: new Date().toISOString()
        }).then(() => {
          setActiveMatchId(id);
          setGameState('DUEL');
          setIncomingChallenge(null);
        });
      });
    });
  };

  const handleDeclineChallenge = async () => {
    if (!incomingChallenge) return;
    sound.playClick?.();
    const { id } = incomingChallenge;
    import('./utils/firebase').then(({ db }) => {
      import('firebase/firestore').then(({ doc, deleteDoc }) => {
        deleteDoc(doc(db, 'matches', id)).then(() => {
          setIncomingChallenge(null);
        });
      });
    });
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {gameState === 'WELCOME' && (
          <WelcomeScreen key="welcome" onAccept={() => {
            sound.init(); 
            sound.playClick(); 
            safeStorage.setItem('block_blast_welcomed', 'true');
            if (!safeStorage.getItem('block_blast_username')) {
               setGameState('USERNAME');
            } else {
               setGameState('MENU');
            }
          }} />
        )}
        {gameState === 'USERNAME' && (
          <UsernameScreen key="username" onComplete={() => setGameState('MENU')} />
        )}
        {gameState === 'MENU' && (
          <MenuScreen key="menu" onStart={() => setGameState('PLAYING')} onOpenSettings={() => setIsSettingsOpen(true)} />
        )}
        {gameState === 'DUEL' && activeMatchId && (
          <DuelScreen 
            key="duel" 
            matchId={activeMatchId} 
            onGoHome={() => {
              setActiveMatchId(null);
              setGameState('MENU');
            }} 
          />
        )}
      </AnimatePresence>

      {(gameState === 'PLAYING' || gameState === 'GAMEOVER') && (
        <GameScreen 
          key={`game-${gameKey}`} 
          onOpenSettings={() => setIsSettingsOpen(true)} 
          onGoHome={() => setGameState('MENU')}
          onGameOver={(score, best) => { 
             setFinalScore(score); 
             setIsBestScore(best); 
             setGameState('GAMEOVER'); 
          }}
        />
      )}

      <AnimatePresence>
        {isSettingsOpen && (
          <SettingsModal key="settings" onClose={() => setIsSettingsOpen(false)} />
        )}
        {gameState === 'GAMEOVER' && (
          <GameOverModal 
             key="gameover" 
             score={finalScore} 
             isBest={isBestScore} 
             onRestart={() => { 
                setGameKey(k => k + 1);
                setGameState('PLAYING'); 
             }} 
          />
        )}
      </AnimatePresence>

      {/* Real-time Match Challenge Prompt Overlay */}
      <AnimatePresence>
        {incomingChallenge && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-zinc-900 border-2 border-indigo-500 rounded-2xl shadow-2xl p-5 max-w-sm w-full text-white"
          >
            <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" /> Challenge Received!
            </h3>
            <p className="text-sm font-bold text-white mt-1.5 leading-snug">
               <span className="text-indigo-300 font-extrabold">{incomingChallenge.challengerUsername}</span> is challenging you to a real-time Duel!
            </p>
            <p className="text-[11px] text-white/40 mt-1">Both of you will play together, compare scores live, and share voice chat!</p>
            
            <div className="flex gap-2 mt-4 text-xs">
              <button
                onClick={handleDeclineChallenge}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700/60 text-white/80 hover:text-white font-black rounded-lg uppercase tracking-wide transition-colors"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptChallenge}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-lg uppercase tracking-wide transition-colors shadow-lg shadow-indigo-600/15"
              >
                Accept
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

