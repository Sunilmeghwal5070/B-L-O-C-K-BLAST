import React, { useState, useEffect } from 'react';
import { GameState } from './types';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MenuScreen } from './components/MenuScreen';
import { GameScreen } from './components/GameScreen';
import { SettingsModal } from './components/SettingsModal';
import { GameOverModal } from './components/GameOverModal';
import { sound } from './utils/soundEngine';
import { AnimatePresence } from 'motion/react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    if (!localStorage.getItem('block_blast_welcomed')) return 'WELCOME';
    if (localStorage.getItem('block_blast_save')) return 'PLAYING';
    return 'MENU';
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [isBestScore, setIsBestScore] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
     let cls = '';
     const theme = localStorage.getItem('block_blast_theme');
     if (theme && theme !== 'default') {
         cls += `${theme}-theme `;
     }
     const bstyle = localStorage.getItem('block_blast_bstyle');
     if (bstyle && bstyle !== 'default') {
         cls += `block-style-${bstyle}`;
     }
     document.body.className = cls.trim();
  }, []);

  return (
    <>
      <AnimatePresence mode="wait">
        {gameState === 'WELCOME' && (
          <WelcomeScreen key="welcome" onAccept={() => {
            sound.init(); 
            sound.playClick(); 
            localStorage.setItem('block_blast_welcomed', 'true');
            setGameState('MENU');
          }} />
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
