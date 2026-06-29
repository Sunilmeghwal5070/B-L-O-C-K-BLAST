import React, { useRef, useState, useEffect } from 'react';
import { Crown, Settings as SettingsIcon, Hand, Home, RefreshCw, Bomb, Lightbulb, Gem, Lock, RotateCcw } from 'lucide-react';
import { useGameEngine, getLevelProgress } from '../hooks/useGameEngine';
import { PreviewShape } from './PreviewShape';
import { cn } from '../utils/cn';
import { GRID_SIZE } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { sound } from '../utils/soundEngine';
import { safeStorage } from '../utils/safeStorage';

import { AnimatedScore } from './AnimatedScore';

const RollingNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    let start = displayValue;
    const end = value;
    if (start === end) return;
    
    const duration = 800; // ms
    const startTime = performance.now();
    
    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(start + (end - start) * progress);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };
    
    requestAnimationFrame(update);
  }, [value]);
  
  return <span>{displayValue}</span>;
};

const FlyingCoin = ({ startPos, endPos, onComplete }: { startPos: {x: number, y: number}, endPos: {x: number, y: number}, onComplete: () => void }) => {
   return (
      <motion.div
         initial={{ x: startPos.x, y: startPos.y, scale: 0, opacity: 1 }}
         animate={{ 
            x: [startPos.x, startPos.x + (Math.random() - 0.5) * 100, endPos.x], 
            y: [startPos.y, startPos.y - 100, endPos.y],
            scale: [0, 1.5, 0.8, 1],
            opacity: [1, 1, 0.8, 0]
         }}
         transition={{ duration: 1.2, ease: "easeOut" }}
         onAnimationComplete={onComplete}
         className="fixed z-[100] pointer-events-none"
      >
         <Gem className="w-5 h-5 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(192,38,211,0.6)] fill-fuchsia-500" />
      </motion.div>
   );
};

const GridCell = React.memo<{
  rI: number;
  cI: number;
  isClearing: boolean;
  isPreviewClearing: boolean;
  isGhost: boolean;
  ghostColor: string | null;
  isPlaced: boolean;
  isBombHover: boolean | null;
  isHintTarget: boolean | null;
  isFilled: boolean;
  colorClass: string | null;
  onPointerEnter: (r: number, c: number) => void;
  onClick: (r: number, c: number) => void;
}>(({
  rI, cI, isClearing, isPreviewClearing, isGhost, ghostColor, isPlaced,
  isBombHover, isHintTarget, isFilled, colorClass, onPointerEnter, onClick
}) => {
  return (
    <div 
      onPointerEnter={() => onPointerEnter(rI, cI)}
      onClick={() => onClick(rI, cI)}
      className={cn(
        "w-full h-full rounded-[2px] transition-all duration-200 relative",
        isFilled && colorClass ? colorClass + ' block-cell' : 'grid-cell-empty',
        isGhost && !isFilled && `${ghostColor} block-cell opacity-80 scale-[0.98]`,
        isPreviewClearing && (isFilled || isGhost) && 'preview-clear',
        isClearing && 'clearing-anim opacity-0', // it glows and vanishes
        isBombHover && 'bg-red-500/50 scale-105 z-10 block-cell',
        isHintTarget && 'hint-blink-anim block-cell'
      )}
    >
      {isPlaced && (
        <div className="particle-container">
           <div className="particle" style={{ left: '-2px', top: '-2px', '--tx': '-10px', '--ty': '-10px' } as React.CSSProperties} />
           <div className="particle" style={{ right: '-2px', top: '-2px', '--tx': '10px', '--ty': '-10px' } as React.CSSProperties} />
           <div className="particle" style={{ left: '-2px', bottom: '-2px', '--tx': '-10px', '--ty': '10px' } as React.CSSProperties} />
           <div className="particle" style={{ right: '-2px', bottom: '-2px', '--tx': '10px', '--ty': '10px' } as React.CSSProperties} />
        </div>
      )}
    </div>
  );
});

type Props = {
  onOpenSettings: () => void;
  onGameOver: (score: number, isBest: boolean) => void;
  onGoHome: () => void;
};

export const GameScreen: React.FC<Props> = ({ onOpenSettings, onGameOver, onGoHome }) => {
  const {
    grid, score, highScore, availableShapes, popups,
    clearingRows, clearingCols, comboCount, isGameOverStatus,
    placedCoords, currentLevel, coins, levelUpData, setLevelUpData,
    spendCoins, triggerBomb, triggerReverse, rerollShape, getHint,
    placeShape, checkAnyFits, checkFits, resetGame
  } = useGameEngine();

  const gridRef = useRef<HTMLDivElement>(null);
  const floatingShapeRef = useRef<HTMLDivElement>(null);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  const [gridCellSize, setGridCellSize] = useState(40);

  const [dragState, setDragState] = useState<{
    index: number;
    startX: number;
    startY: number;
  } | null>(null);

  const [hoverGridPos, setHoverGridPos] = useState<{ gridX: number, gridY: number } | null>(null);
  
  const [activePowerUp, setActivePowerUp] = useState<'bomb' | 'replace' | null>(null);
  const [hintCoords, setHintCoords] = useState<{r: number, c: number, shapeIndex: number} | null>(null);
  const [bombHoverPos, setBombHoverPos] = useState<{r: number, c: number} | null>(null);

  const [tutorialStep, setTutorialStep] = useState(() => {
    return safeStorage.getItem('block_blast_tutorial_done') ? 0 : 1;
  });

  const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);
  const [flyingCoins, setFlyingCoins] = useState<{id: number}[]>([]);
  
  const coinBalRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (levelUpData) {
       // Trigger coin flight
       sound.playClear();
       const newCoins = Array.from({ length: 12 }).map((_, i) => ({ id: Date.now() + i }));
       setFlyingCoins(newCoins);
       
       // Auto-clear level up message/effect after a bit
       setTimeout(() => setLevelUpData(null), 3000);
    }
  }, [levelUpData, setLevelUpData]);

  useEffect(() => {
    if (tutorialStep === 1 && score > 0) {
      setTutorialStep(2);
    }
  }, [score, tutorialStep]);

  useEffect(() => {
    if (tutorialStep === 2 && (clearingRows.length > 0 || clearingCols.length > 0)) {
      setTutorialStep(3);
      setTimeout(() => {
        setTutorialStep(0);
        safeStorage.setItem('block_blast_tutorial_done', 'true');
      }, 3000);
    }
  }, [clearingRows, clearingCols, tutorialStep]);

  // Measure cell size
  useEffect(() => {
    const measure = () => {
      if (gridRef.current) {
        const firstCell = gridRef.current.firstElementChild;
        if (firstCell) {
          setGridCellSize(firstCell.getBoundingClientRect().width);
        }
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const gridRectRef = useRef<DOMRect | null>(null);

  // Check game over effect
  useEffect(() => {
    let timeoutId: any;
    if (isGameOverStatus) {
      timeoutId = setTimeout(() => {
        sound.playGameOver();
        onGameOver(score, score >= highScore && score > 0);
      }, 500); 
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isGameOverStatus, score, highScore, onGameOver]);

  useEffect(() => {
    const handler = setTimeout(() => {
        import('../utils/firebase').then(({ db, currentUser }) => {
            if (currentUser) {
                import('firebase/firestore').then(({ doc, setDoc }) => {
                    const username = safeStorage.getItem('block_blast_username');
                    if (username) {
                        setDoc(doc(db, "users", currentUser.uid), {
                            username,
                            score,
                            updatedAt: new Date().toISOString()
                        }, { merge: true });
                    }
                });
            }
        });
    }, 2000);
    return () => clearTimeout(handler);
  }, [score]);



  // Hook into clears for immediate sound
  useEffect(() => {
      if (clearingRows.length > 0 || clearingCols.length > 0) {
          sound.playClear();
      }
  }, [clearingRows, clearingCols]);


  // Helper for generating the ghost preview during drag
  let highlightCoords: {r: number, c: number, color: string}[] = [];
  let previewClearingRows: number[] = [];
  let previewClearingCols: number[] = [];

  if (dragState && hoverGridPos) {
      const { index } = dragState;
      const shape = availableShapes[index];
      if (shape) {
          const { gridX, gridY } = hoverGridPos;
          const isGhostValid = checkFits(shape, grid, gridX, gridY);
          if (isGhostValid) {
              for (let r = 0; r < shape.matrix.length; r++) {
                 for (let c = 0; c < shape.matrix[0].length; c++) {
                     if (shape.matrix[r][c] === 1) {
                        highlightCoords.push({ r: gridY + r, c: gridX + c, color: shape.colorClass });
                     }
                 }
              }
              
              // Calculate preview lines
              for (let r = 0; r < GRID_SIZE; r++) {
                  let isFull = true;
                  for (let c = 0; c < GRID_SIZE; c++) {
                      if (!grid[r][c].isFilled && !highlightCoords.some(coord => coord.r === r && coord.c === c)) {
                          isFull = false;
                          break;
                      }
                  }
                  if (isFull) previewClearingRows.push(r);
              }
              for (let c = 0; c < GRID_SIZE; c++) {
                  let isFull = true;
                  for (let r = 0; r < GRID_SIZE; r++) {
                      if (!grid[r][c].isFilled && !highlightCoords.some(coord => coord.r === r && coord.c === c)) {
                          isFull = false;
                          break;
                      }
                  }
                  if (isFull) previewClearingCols.push(c);
              }
          }
      }
  }


  const handleHintClick = () => {
     if (hintCoords) { setHintCoords(null); return; }
     if (coins >= 50) {
         const hint = getHint();
         if (hint) {
             if (spendCoins(50)) {
                 setHintCoords(hint);
                 sound.playClick();
                 setTimeout(() => setHintCoords(null), 1800);
             }
         }
     } else {
         sound.playError?.();
     }
  };

  const handleCellClick = React.useCallback((r: number, c: number) => {
     if (activePowerUp === 'bomb') {
        if (spendCoins(50)) {
           triggerBomb(r, c);
           sound.playClear();
        } else {
           sound.playError?.();
        }
        setActivePowerUp(null);
        setBombHoverPos(null);
     }
  }, [activePowerUp, spendCoins, triggerBomb]);

  const handleCellPointerEnter = React.useCallback((r: number, c: number) => {
    if (activePowerUp === 'bomb') {
      setBombHoverPos({ r, c });
    }
  }, [activePowerUp]);

  const handleShapeClick = (index: number, e: React.PointerEvent) => {
     if (activePowerUp === 'replace' && availableShapes[index]) {
        if (spendCoins(50)) {
           rerollShape(index);
           sound.playPlace();
        } else {
           sound.playError?.();
        }
        setActivePowerUp(null);
        return;
     }

     if (activePowerUp) return; // Prevent drag if other powerup is active

     e.preventDefault();
     sound.playSelect?.();
     pointerPosRef.current = { x: e.clientX, y: e.clientY };
     setDragState({ index, startX: e.clientX, startY: e.clientY });

     const onMove = (eMove: PointerEvent) => {
        eMove.preventDefault();
        pointerPosRef.current = { x: eMove.clientX, y: eMove.clientY };
        
        let rafId: number;
        if (floatingShapeRef.current) {
           rafId = requestAnimationFrame(() => {
              if (floatingShapeRef.current) {
                 floatingShapeRef.current.style.transform = `translate3d(${eMove.clientX}px, ${eMove.clientY}px, 0)`;
              }
           });
        }

        if (gridRef.current) {
          if (!gridRectRef.current) {
             gridRectRef.current = gridRef.current.getBoundingClientRect();
          }
          const rect = gridRectRef.current;
          const cellW = rect.width / GRID_SIZE;
          const cellH = rect.height / GRID_SIZE;

          const pieceCX = eMove.clientX;
          const pieceCY = eMove.clientY;

          const relX = pieceCX - rect.left;
          const relY = pieceCY - rect.top;

          if (relX >= -cellW && relX <= rect.width + cellW && relY >= -cellH && relY <= rect.height + cellH) {
              const shape = availableShapes[index];
              if (shape) {
                 const cols = shape.matrix[0].length;
                 const rows = shape.matrix.length;
                 
                 const exactCol = relX / cellW;
                 const exactRow = relY / cellH;

                 const gridX = Math.round(exactCol - cols / 2);
                 const gridY = Math.round(exactRow - rows / 2);

                 setHoverGridPos(prev => {
                    if (!prev || prev.gridX !== gridX || prev.gridY !== gridY) return { gridX, gridY };
                    return prev;
                 });
              }
          } else {
              setHoverGridPos(prev => prev !== null ? null : prev);
          }
        }
     };

     const onUp = (eUp: PointerEvent) => {
        const currX = pointerPosRef.current.x;
        const currY = pointerPosRef.current.y;
        
        let dropGridPos: { gridX: number, gridY: number } | null = null;

        if (gridRef.current) {
          if (!gridRectRef.current) {
             gridRectRef.current = gridRef.current.getBoundingClientRect();
          }
          const rect = gridRectRef.current;
          const cellW = rect.width / GRID_SIZE;
          const cellH = rect.height / GRID_SIZE;
          
          const pieceCX = currX;
          const pieceCY = currY;
          const relX = pieceCX - rect.left;
          const relY = pieceCY - rect.top;

          if (relX >= -cellW && relX <= rect.width + cellW && relY >= -cellH && relY <= rect.height + cellH) {
              const shape = availableShapes[index];
              if (shape) {
                 const cols = shape.matrix[0].length;
                 const rows = shape.matrix.length;
                 const exactCol = relX / cellW;
                 const exactRow = relY / cellH;
                 const gridX = Math.round(exactCol - cols / 2);
                 const gridY = Math.round(exactRow - rows / 2);
                 dropGridPos = { gridX, gridY };
              }
          }
        }
        
        if (dropGridPos) {
           const success = placeShape(index, dropGridPos.gridX, dropGridPos.gridY, currX, currY);
           if (success) {
              sound.playPlace();
           } else {
              sound.playDeselect();
           }
        } else {
           sound.playDeselect();
        }
        
        setDragState(null);
        setHoverGridPos(null);
        
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
     };

     document.addEventListener('pointermove', onMove, { passive: false });
     document.addEventListener('pointerup', onUp);
  };

  const handleReverseClick = () => {
    if (currentLevel < 4) return;
    if (spendCoins(50)) {
       if (!triggerReverse()) {
          sound.playError();
       }
    } else {
       sound.playError();
    }
  };
  
  // Clean up bomb hover
  useEffect(() => {
     if (activePowerUp !== 'bomb') setBombHoverPos(null);
  }, [activePowerUp]);

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-4 w-full h-full relative select-none touch-none">
      
      {/* Header */}
      <div className="w-full max-w-[400px] flex justify-between items-center mt-2 z-10">
        <div className="flex flex-col gap-1">
           <div className="flex items-center gap-1">
             <Crown className="w-5 h-5 text-yellow-400 drop-shadow-md" />
             <span className="text-lg font-bold text-yellow-500 drop-shadow-md">{highScore}</span>
           </div>
           <div ref={coinBalRef} className="flex items-center gap-1">
             <Gem className="w-5 h-5 text-fuchsia-400 drop-shadow-md" />
             <div className="text-lg font-bold text-fuchsia-400 drop-shadow-md">
                <RollingNumber value={coins} />
             </div>
           </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { sound.playClick(); setIsHomeModalOpen(true); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all">
            <Home className="w-6 h-6 text-white" />
          </button>
          <button onClick={() => { sound.playClick(); resetGame(); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all">
            <RefreshCw className="w-6 h-6 text-white" />
          </button>
          <button onClick={onOpenSettings} className="p-2 bg-white/10 rounded-full hover:bg-white/20 active:scale-95 transition-all">
            <SettingsIcon className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Score and Level */}
      <div className="w-full flex-col flex items-center justify-center mb-4 mt-2 z-10">
         <div className="w-full max-w-[250px] mb-2 flex flex-col items-center">
            {(() => {
               const progress = getLevelProgress(score);
               return (
                 <>
                   <div className="w-full flex justify-between text-xs text-blue-200 font-bold mb-1">
                      <span className="bg-blue-600 px-2 py-0.5 rounded-full text-white">Lv {currentLevel}</span>
                      <span>{score} / {progress.totalRequiredForNextLevel}</span>
                   </div>
                   <div ref={progressBarRef} className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner relative">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / progress.totalRequiredForNextLevel) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                   </div>
                   {levelUpData && (
                         <AnimatePresence>
                            <motion.div
                              initial={{ y: 20, opacity: 0, scale: 0.5 }}
                              animate={{ y: -85, opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, y: -130, scale: 0.8 }}
                              className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-[110]"
                            >
                               <motion.div 
                                 animate={{ 
                                    rotate: [0, -5, 5, -5, 0],
                                    scale: [1, 1.1, 1, 1.1, 1]
                                 }}
                                 transition={{ repeat: Infinity, duration: 2 }}
                                 className="bg-gradient-to-b from-yellow-300 via-orange-400 to-orange-600 p-0.5 rounded-2xl shadow-[0_0_25px_rgba(245,158,11,0.6)]"
                               >
                                  <div className="bg-slate-900 px-5 py-3 rounded-[14px] flex flex-col items-center border border-white/20">
                                     <span className="text-yellow-400 font-black text-sm uppercase tracking-widest mb-1 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)] whitespace-nowrap">LEVEL UP!</span>
                                     <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-full border border-white/5">
                                           <Gem className="w-4 h-4 text-fuchsia-400 fill-fuchsia-400/20" />
                                           <span className="text-white font-black text-xl">+50</span>
                                        </div>
                                     </div>
                                     {levelUpData.unlock && (
                                        <div className="mt-1 text-[10px] text-white/60 font-bold uppercase tracking-tighter">
                                           {levelUpData.unlock} Unlocked!
                                        </div>
                                     )}
                                  </div>
                               </motion.div>
                               {/* Arrow connecting to progress bar */}
                               <motion.div 
                                 animate={{ y: [0, 5, 0] }}
                                 transition={{ repeat: Infinity, duration: 1 }}
                                 className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] border-t-orange-600 mt-[-2px] drop-shadow-lg"
                               />
                            </motion.div>
                         </AnimatePresence>
                      )}
                  </>
               );
            })()}
         </div>
         <AnimatePresence mode="popLayout">
             <AnimatedScore value={score} />
         </AnimatePresence>
      </div>

      {/* Rest of the UI below (Grid, Pieces, Popups) */}
      <AnimatePresence>
         {flyingCoins.map((coin) => {
            if (!coinBalRef.current || !progressBarRef.current) return null;
            const startRect = progressBarRef.current.getBoundingClientRect();
            const endRect = coinBalRef.current.getBoundingClientRect();
            return (
               <FlyingCoin 
                  key={coin.id}
                  startPos={{ x: startRect.left + startRect.width/2, y: startRect.top }}
                  endPos={{ x: endRect.left, y: endRect.top }}
                  onComplete={() => setFlyingCoins(prev => prev.filter(c => c.id !== coin.id))}
               />
            );
         })}
      </AnimatePresence>
      <div className="relative w-full max-w-[400px] flex-1 flex flex-col justify-end gap-10">
          
          {/* Main Grid */}
          <div className="relative">
            <div 
              ref={gridRef}
              className="bg-[#1C2759] p-1.5 rounded-lg grid gap-[1px] w-full aspect-square shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-[#2A3771] touch-none"
              style={{
                gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${GRID_SIZE}, minmax(0, 1fr))`
              }}
            >
              {grid.map((row, rI) => 
                row.map((cell, cI) => {
                  const isClearing = clearingRows.includes(rI) || clearingCols.includes(cI);
                  const isPreviewClearing = previewClearingRows.includes(rI) || previewClearingCols.includes(cI);
                  const ghost = highlightCoords.find(c => c.r === rI && c.c === cI);
                  const isGhost = !!ghost;
                  const isPlaced = placedCoords.some(c => c.r === rI && c.c === cI);
                  
                  const isBombHover = bombHoverPos && Math.abs(bombHoverPos.r - rI) <= 1 && Math.abs(bombHoverPos.c - cI) <= 1;
                 const shapeShape = hintCoords ? availableShapes[hintCoords.shapeIndex]?.matrix : null;
                 
                  const isHintTarget = hintCoords && hintCoords.r <= rI && hintCoords.r + (shapeShape?.length || 0) > rI && hintCoords.c <= cI && hintCoords.c + (shapeShape?.[0]?.length || 0) > cI && shapeShape?.[rI - hintCoords.r][cI - hintCoords.c] === 1;

                  return (
                    <GridCell
                      key={`${rI}-${cI}`}
                      rI={rI}
                      cI={cI}
                      isFilled={cell.isFilled}
                      colorClass={cell.colorClass}
                      isClearing={isClearing}
                      isPreviewClearing={isPreviewClearing}
                      isGhost={isGhost}
                      ghostColor={ghost?.color || null}
                      isPlaced={isPlaced}
                      isBombHover={isBombHover}
                      isHintTarget={isHintTarget}
                      onPointerEnter={handleCellPointerEnter}
                      onClick={handleCellClick}
                    />
                  );
                })
              )}

              {/* Render absolute popups tied to Grid area */}
              {popups.map(p => {
                 let textClass = "popup-text";
                 if (['Awesome!', 'Super!', 'PERFECT!'].includes(p.text)) textClass = "popup-text-huge text-4xl tracking-tight";
                 else if (p.text.startsWith('Combo')) textClass = "popup-text-combo text-3xl";
                 else textClass = "popup-text text-2xl";
                 
                 return (
                   <div
                      key={p.id}
                      className={`fixed font-black pointer-events-none z-50 whitespace-nowrap ${textClass}`}
                      style={{ left: p.x - 40, top: p.y - 40, color: p.color }}
                   >
                     {p.text}
                   </div>
                 );
              })}
            </div>

          </div>

          {/* Power Ups */}
          <div className="w-full max-w-[400px] flex justify-center gap-4 mt-1 mb-[-15px] z-10">
             <button 
               onClick={() => currentLevel >= 3 ? (activePowerUp === 'bomb' ? setActivePowerUp(null) : setActivePowerUp('bomb')) : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group relative", activePowerUp === 'bomb' ? "bg-red-500/40 border-red-400 scale-[1.05]" : "bg-black/30 border-black/50 hover:bg-black/40", currentLevel < 3 && "opacity-50 grayscale")}
             >
                {currentLevel < 3 && <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <Bomb className={cn("w-4 h-4 drop-shadow-lg", activePowerUp === 'bomb' ? "text-red-400 fill-red-500/20 animate-pulse" : "text-gray-300")} />
                {currentLevel >= 3 ? (
                   <div className="flex items-center font-bold"><span className="text-xs text-white">50</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
                ) : (
                   <span className="text-[10px] font-bold text-white/70 uppercase">Lvl 3</span>
                )}
             </button>

             <button 
               onClick={() => handleHintClick()}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group bg-black/30 border-black/50 hover:bg-black/40 relative")}
             >
                <Lightbulb className={cn("w-4 h-4 drop-shadow-lg", hintCoords ? "text-yellow-400 fill-yellow-500/20 animate-pulse" : "text-gray-300")} />
                <div className="flex items-center font-bold"><span className="text-xs text-white">50</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
             </button>

             <button 
               onClick={() => currentLevel >= 2 ? (activePowerUp === 'replace' ? setActivePowerUp(null) : setActivePowerUp('replace')) : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group relative", activePowerUp === 'replace' ? "bg-blue-500/40 border-blue-400 scale-[1.05]" : "bg-black/30 border-black/50 hover:bg-black/40", currentLevel < 2 && "opacity-50 grayscale")}
             >
                {currentLevel < 2 && <div className="absolute -top-1 -right-1 bg-blue-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <RefreshCw className={cn("w-4 h-4 drop-shadow-lg", activePowerUp === 'replace' ? "text-blue-400 animate-[spin_3s_linear_infinite]" : "text-gray-300")} />
                {currentLevel >= 2 ? (
                   <div className="flex items-center font-bold"><span className="text-xs text-white">50</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
                ) : (
                   <span className="text-[10px] font-bold text-white/70 uppercase">Lvl 2</span>
                )}
             </button>

             <button 
               onClick={() => currentLevel >= 4 ? handleReverseClick() : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group relative", currentLevel >= 4 ? "bg-black/30 border-black/50 hover:bg-black/40" : "opacity-50 grayscale")}
             >
                {currentLevel < 4 && <div className="absolute -top-1 -right-1 bg-fuchsia-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <RotateCcw className={cn("w-4 h-4 drop-shadow-lg text-gray-300")} />
                {currentLevel >= 4 ? (
                  <div className="flex items-center font-bold"><span className="text-xs text-white">50</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
                ) : (
                  <span className="text-[10px] font-bold text-white/70 uppercase">Lvl 4</span>
                )}
             </button>
          </div>

          {/* Available Shapes Tray */}
          <div className="w-full max-w-[400px] bg-[#1C2759] border border-[#2A3771] shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center px-2 h-24 relative">
              <AnimatePresence>
                {availableShapes.map((shape, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0 }}
                    className="flex-1 flex justify-center items-center h-full relative"
                  >
                    {shape && (
                      <div 
                        className={cn(
                          "cursor-grab active:cursor-grabbing touch-none", 
                          dragState?.index === idx ? 'opacity-20' : 'opacity-100'
                        )}
                        onPointerDown={(e) => handleShapeClick(idx, e)}
                      >
                        <div className="origin-center hover:scale-[1.05] transition-transform flex justify-center items-center">
                          <PreviewShape 
                            shape={shape} 
                            cellSize={Math.min(18, 80 / Math.max(shape.matrix.length, shape.matrix[0].length))} 
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
      </div>

      {/* Floating Dragged Shape */}
      {dragState && availableShapes[dragState.index] && (
        <div 
          ref={(el) => {
            floatingShapeRef.current = el;
            if (el && pointerPosRef.current) {
              el.style.transform = `translate3d(${pointerPosRef.current.x}px, ${pointerPosRef.current.y}px, 0)`;
            }
          }}
          className="fixed pointer-events-none z-50 top-0 left-0 will-change-transform"
        >
           <div 
             style={{ 
               transform: 'translate3d(-50%, -50%, 0) scale(1.1)',
               transition: 'transform 0.1s ease-out'
             }}
             className="drop-shadow-[0_15px_40px_rgba(0,0,0,0.6)]"
           >
             <PreviewShape shape={availableShapes[dragState.index]!} cellSize={gridCellSize} />
           </div>
        </div>
      )}

      {/* Tutorial Overlays */}
      <AnimatePresence>
        {tutorialStep === 1 && !dragState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-black/40"
          >
            {/* Animated Hand & Shape */}
            <motion.div
              initial={{ y: 250, x: 0 }}
              animate={{ y: [250, 250, 0, 0, 250] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute top-[40%] flex flex-col items-center text-white"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1.2, 1, 1], opacity: [0, 1, 1, 0, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                className="mb-1 grid grid-cols-2 gap-[1px] bg-white/20 p-[1px] rounded"
              >
                  <div className="w-6 h-6 bg-cyan-400 rounded-[2px]" />
                  <div className="w-6 h-6 bg-cyan-400 rounded-[2px]" />
                  <div className="w-6 h-6 bg-cyan-400 rounded-[2px]" />
                  <div className="w-6 h-6 bg-cyan-400 rounded-[2px]" />
              </motion.div>
              <motion.div
                 animate={{ scale: [1, 0.9, 0.9, 1, 1] }}
                 transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Hand className="w-16 h-16 fill-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]" />
              </motion.div>
            </motion.div>
          </motion.div>
        )}

        {tutorialStep === 2 && !dragState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/40"
          >
            {/* Visual indication of a line blast */}
            <motion.div
              className="relative w-full max-w-[300px] h-16 flex border-2 border-white/20 rounded-lg p-1 gap-1"
            >
               {[0, 1, 2, 3, 4, 5, 6].map(i => (
                  <motion.div 
                     key={i}
                     className="flex-1 bg-yellow-400 rounded-sm"
                     animate={{ opacity: [1, 1, 0, 0, 1], scale: [1, 1, 1.2, 0, 1] }}
                     transition={{ repeat: Infinity, duration: 3, delay: i * 0.05 }}
                  />
               ))}
               <motion.div
                 className="absolute inset-0 bg-white shadow-[0_0_50px_rgba(255,255,255,0.8)] rounded-lg"
                 animate={{ opacity: [0, 0, 1, 0, 0] }}
                 transition={{ repeat: Infinity, duration: 3 }}
               />
            </motion.div>
          </motion.div>
        )}

        {tutorialStep === 3 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center"
          >
            <div className="bg-gradient-to-b from-yellow-400 to-orange-500 text-white font-black px-8 py-4 rounded-3xl shadow-[0_10px_40px_rgba(250,204,21,0.6)] border-4 border-white text-4xl transform -tracking-tight">
              Awesome!!
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHomeModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#1C2759] border-2 border-[#2A3771] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center"
            >
               <h2 className="text-2xl font-black text-white mb-2">Exit to Menu?</h2>
               <p className="text-blue-200 mb-6 text-sm">Your progress in this round will be lost. Are you sure you want to quit?</p>
               
               <div className="flex gap-3">
                  <button 
                     onClick={() => { sound.playClick(); setIsHomeModalOpen(false); }}
                     className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-[0_4px_0_1px_#374151]"
                  >
                     Cancel
                  </button>
                  <button 
                     onClick={() => { sound.playClick(); setIsHomeModalOpen(false); onGoHome(); }}
                     className="flex-1 bg-gradient-to-b from-red-500 to-red-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-[0_4px_0_1px_#991b1b]"
                  >
                     Exit
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
};
