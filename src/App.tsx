import React, { useState, useEffect } from 'react';
import { GameState } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { UsernameScreen } from './components/UsernameScreen';
import { MenuScreen } from './components/MenuScreen';
import { GameScreen } from './components/GameScreen';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { sound } from './utils/soundEngine';
import { AnimatePresence } from 'motion/react';
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

  useEffect(() => {
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
                           score,
                           updatedAt: new Date().toISOString()
                       }, { merge: true });
                   });
               }
           });
        });
     }
  }, []);

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
    </>
  );
}

