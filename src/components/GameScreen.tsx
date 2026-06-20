import React, { useRef, useState, useEffect } from 'react';
import { Crown, Settings as SettingsIcon, Hand, Home, RefreshCw, Bomb, Lightbulb, Gem, Lock } from 'lucide-react';
import { useGameEngine, getLevelProgress } from '../hooks/useGameEngine';
import { PreviewShape } from './PreviewShape';
import { cn } from '../utils/cn';
import { GRID_SIZE } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { sound } from '../utils/soundEngine';

import { AnimatedScore } from './AnimatedScore';
import { LevelUpModal } from './LevelUpModal';

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
    spendCoins, triggerBomb, rerollShape, getHint,
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
    return localStorage.getItem('block_blast_tutorial_done') ? 0 : 1;
  });

  const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);

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
        localStorage.setItem('block_blast_tutorial_done', 'true');
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
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState) return;
      e.preventDefault();
      
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
      const { index } = dragState;
      const DRAG_OFFSET_Y = 100;

      // Update floating element directly to bypass React render for extreme smoothness
      if (floatingShapeRef.current) {
         floatingShapeRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY - DRAG_OFFSET_Y}px, 0)`;
      }

      if (gridRef.current) {
        if (!gridRectRef.current) {
           gridRectRef.current = gridRef.current.getBoundingClientRect();
        }
        const rect = gridRectRef.current;
        const cellW = rect.width / GRID_SIZE;
        const cellH = rect.height / GRID_SIZE;

        const pieceCX = e.clientX;
        const pieceCY = e.clientY - DRAG_OFFSET_Y;

        const relX = pieceCX - rect.left;
        const relY = pieceCY - rect.top;

        if (relX >= -cellW && relX <= rect.width + cellW && relY >= -cellH && relY <= rect.height + cellH) {
            const shape = availableShapes[index];
            if (shape) {
               const cols = shape.matrix[0].length;
               const rows = shape.matrix.length;
               
               const exactCol = relX / cellW;
               const exactRow = relY / cellH;

               // Align visual center to grid center continuously
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

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragState) return;
      
      const { index } = dragState;
      const currX = pointerPosRef.current.x;
      const currY = pointerPosRef.current.y;
      
      let dropGridPos = hoverGridPos;

      // Ensure synchronously accurate position
      if (gridRectRef.current) {
        const rect = gridRectRef.current;
        const cellW = rect.width / GRID_SIZE;
        const cellH = rect.height / GRID_SIZE;
        const DRAG_OFFSET_Y = 100;
        
        const pieceCX = currX;
        const pieceCY = currY - DRAG_OFFSET_Y;
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
        } else {
            dropGridPos = null;
        }
      }
      
      if (dropGridPos) {
         const success = placeShape(index, dropGridPos.gridX, dropGridPos.gridY, currX, currY);
         if (success) {
            sound.playPlace();
         }
      }
      
      setDragState(null);
      setHoverGridPos(null);
    };

    if (dragState) {
      document.addEventListener('pointermove', handlePointerMove, { passive: false });
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, availableShapes, placeShape, hoverGridPos]);

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
                 setTimeout(() => setHintCoords(null), 3000);
             }
         }
     } else {
         sound.playError?.();
     }
  };

  const handleCellClick = (r: number, c: number) => {
     if (activePowerUp === 'bomb') {
        if (spendCoins(150)) {
           triggerBomb(r, c);
           sound.playClear();
        } else {
           sound.playError?.();
        }
        setActivePowerUp(null);
        setBombHoverPos(null);
     }
  };

  const handleShapeClick = (index: number, e: React.PointerEvent) => {
     if (activePowerUp === 'replace' && availableShapes[index]) {
        if (spendCoins(80)) {
           rerollShape(index);
           sound.playDrop();
        } else {
           sound.playError?.();
        }
        setActivePowerUp(null);
        return;
     }

     if (activePowerUp) return; // Prevent drag if other powerup is active

     e.preventDefault();
     pointerPosRef.current = { x: e.clientX, y: e.clientY };
     setDragState({ index, startX: e.clientX, startY: e.clientY });
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
           <div className="flex items-center gap-1">
             <Gem className="w-5 h-5 text-fuchsia-400 drop-shadow-md" />
             <span className="text-lg font-bold text-fuchsia-400 drop-shadow-md">{coins}</span>
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
                   <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / progress.totalRequiredForNextLevel) * 100}%` }}
                        transition={{ duration: 0.3 }}
                      />
                   </div>
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
         {levelUpData && (
            <LevelUpModal data={levelUpData} onClose={() => setLevelUpData(null)} />
         )}
      </AnimatePresence>
      <div className="relative w-full max-w-[400px] flex-1 flex flex-col justify-end gap-10">
          
          {/* Main Grid */}
          <div className="relative">
            <div 
              ref={gridRef}
              className="bg-[#1C2759] p-1.5 rounded-lg grid gap-[1px] w-full aspect-square shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-[#2A3771]"
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
                  const isHintTarget = hintCoords && hintCoords.r <= rI && hintCoords.r + (availableShapes[hintCoords.shapeIndex]?.matrix.length || 0) > rI && hintCoords.c <= cI && hintCoords.c + (availableShapes[hintCoords.shapeIndex]?.matrix[0].length || 0) > cI && availableShapes[hintCoords.shapeIndex]?.matrix[rI - hintCoords.r][cI - hintCoords.c] === 1;

                  return (
                    <div 
                      key={`${rI}-${cI}`}
                      onPointerEnter={() => activePowerUp === 'bomb' && setBombHoverPos({ r: rI, c: cI })}
                      onClick={() => handleCellClick(rI, cI)}
                      className={cn(
                        "w-full h-full rounded-[2px] transition-all duration-200 relative",
                        cell.isFilled && cell.colorClass ? cell.colorClass + ' block-cell' : 'grid-cell-empty',
                        isGhost && !cell.isFilled && `${ghost.color} block-cell opacity-50`,
                        isPreviewClearing && (cell.isFilled || isGhost) && 'preview-clear',
                        isClearing && 'clearing-anim opacity-0', // it glows and vanishes
                        isBombHover && 'bg-red-500/50 scale-105 z-10 block-cell',
                        isHintTarget && 'bg-yellow-400/50 animate-pulse block-cell'
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
               onClick={() => currentLevel >= 2 ? (activePowerUp === 'bomb' ? setActivePowerUp(null) : setActivePowerUp('bomb')) : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group relative", activePowerUp === 'bomb' ? "bg-red-500/40 border-red-400 scale-[1.05]" : "bg-black/30 border-black/50 hover:bg-black/40", currentLevel < 2 && "opacity-50 grayscale")}
             >
                {currentLevel < 2 && <div className="absolute -top-1 -right-1 bg-red-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <Bomb className={cn("w-4 h-4 drop-shadow-lg", activePowerUp === 'bomb' ? "text-red-400 fill-red-500/20 animate-pulse" : "text-gray-300")} />
                {currentLevel >= 2 ? (
                   <div className="flex items-center font-bold"><span className="text-xs text-white">150</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
                ) : (
                   <span className="text-[10px] font-bold text-white/70 uppercase">Lvl 2</span>
                )}
             </button>

             <button 
               onClick={() => currentLevel >= 3 ? handleHintClick() : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group bg-black/30 border-black/50 hover:bg-black/40 relative", currentLevel < 3 && "opacity-50 grayscale")}
             >
                {currentLevel < 3 && <div className="absolute -top-1 -right-1 bg-yellow-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <Lightbulb className={cn("w-4 h-4 drop-shadow-lg", hintCoords ? "text-yellow-400 fill-yellow-500/20 animate-pulse" : "text-gray-300")} />
                {currentLevel >= 3 ? (
                   <div className="flex items-center font-bold"><span className="text-xs text-white">50</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
                ) : (
                   <span className="text-[10px] font-bold text-white/70 uppercase">Lvl 3</span>
                )}
             </button>

             <button 
               onClick={() => currentLevel >= 4 ? (activePowerUp === 'replace' ? setActivePowerUp(null) : setActivePowerUp('replace')) : null}
               className={cn("flex items-center justify-center gap-1 px-3 py-1.5 rounded-full border-2 transition-all shadow-md group relative", activePowerUp === 'replace' ? "bg-blue-500/40 border-blue-400 scale-[1.05]" : "bg-black/30 border-black/50 hover:bg-black/40", currentLevel < 4 && "opacity-50 grayscale")}
             >
                {currentLevel < 4 && <div className="absolute -top-1 -right-1 bg-blue-600 rounded-full p-0.5"><Lock className="w-3 h-3 text-white" /></div>}
                <RefreshCw className={cn("w-4 h-4 drop-shadow-lg", activePowerUp === 'replace' ? "text-blue-400 animate-[spin_3s_linear_infinite]" : "text-gray-300")} />
                {currentLevel >= 4 ? (
                   <div className="flex items-center font-bold"><span className="text-xs text-white">80</span><Gem className="w-3 h-3 ml-0.5 text-fuchsia-400"/></div>
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
                          "transition-opacity duration-200 cursor-grab active:cursor-grabbing", 
                          dragState?.index === idx ? 'opacity-0' : 'opacity-100'
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
              const DRAG_OFFSET_Y = 100;
              el.style.transform = `translate3d(${pointerPosRef.current.x}px, ${pointerPosRef.current.y - DRAG_OFFSET_Y}px, 0)`;
            }
          }}
          className="fixed pointer-events-none z-50 top-0 left-0"
        >
           <motion.div 
             initial={{ scale: 0.5 }}
             animate={{ scale: 1 }}
             transition={{ type: 'spring', bounce: 0.4, duration: 0.3 }}
             className="transform -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
           >
             <PreviewShape shape={availableShapes[dragState.index]!} cellSize={gridCellSize} />
           </motion.div>
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
            <div className="absolute top-[35%] bg-blue-500 text-white font-bold px-6 py-3 rounded-full shadow-lg border-2 border-white text-xl animate-pulse">
              Drag a shape to the board!
            </div>
            {/* Animated Hand */}
            <motion.div
              initial={{ y: 250, scale: 1 }}
              animate={{ y: [250, 250, 0, 0, 250], scale: [1, 0.9, 0.9, 1, 1], x: [0, 0, -50, -50, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              className="absolute top-[40%] text-white"
            >
              <Hand className="w-16 h-16 fill-white drop-shadow-2xl" />
            </motion.div>
          </motion.div>
        )}

        {tutorialStep === 2 && !dragState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center bg-black/40"
          >
            <div className="absolute top-[35%] bg-purple-500 text-white font-bold px-6 py-3 rounded-full shadow-lg border-2 border-white text-xl text-center">
              Fill a complete row or column <br/> to blast blocks!
            </div>
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
