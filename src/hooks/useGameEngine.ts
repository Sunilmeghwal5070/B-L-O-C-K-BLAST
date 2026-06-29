import { useState, useCallback, useEffect } from 'react';
import { GridCellData, ShapeDef, Pos, PopupText } from '../types';
import { SHAPES_LIBRARY, GRID_SIZE, BLOCK_COLORS } from '../constants';
import { safeStorage } from '../utils/safeStorage';
import { sound } from '../utils/soundEngine';

const createEmptyGrid = (): GridCellData[][] =>
  Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill({ isFilled: false, colorClass: null }));

export const getLevelProgress = (score: number) => {
  let level = 1;
  let required = 150;
  let currentBasis = 0;
  while (score >= currentBasis + required) {
    currentBasis += required;
    level++;
    required += 100;
  }
  return {
    currentScoreInLevel: score - currentBasis,
    requiredForNextLevel: required,
    totalRequiredForNextLevel: currentBasis + required,
    level
  };
};

export function useGameEngine() {
  const [grid, setGrid] = useState<GridCellData[][]>(() => {

    const saved = safeStorage.getItem('block_blast_save');
    if (saved) {
      try { return JSON.parse(saved).grid; } catch (e) {}
    }
    return createEmptyGrid();
  });
  const [score, setScore] = useState(() => {
    const saved = safeStorage.getItem('block_blast_save');
    if (saved) {
      try { return JSON.parse(saved).score; } catch (e) {}
    }
    return 0;
  });
  const [highScore, setHighScore] = useState(0);
  const [availableShapes, setAvailableShapes] = useState<(ShapeDef | null)[]>(() => {
    const saved = safeStorage.getItem('block_blast_save');
    if (saved) {
      try { return JSON.parse(saved).availableShapes; } catch (e) {}
    }
    return [null, null, null];
  });
  const [clearingRows, setClearingRows] = useState<number[]>([]);
  const [clearingCols, setClearingCols] = useState<number[]>([]);
  const [popups, setPopups] = useState<PopupText[]>([]);
  const [comboCount, setComboCount] = useState(0);
  const [isGameOverStatus, setIsGameOverStatus] = useState(false);
  const [hasRescuedCount, setHasRescuedCount] = useState(0);
  const [placedCoords, setPlacedCoords] = useState<{r: number, c: number}[]>([]);
  const [history, setHistory] = useState<{
    grid: GridCellData[][],
    availableShapes: (ShapeDef | null)[],
    score: number,
    comboCount: number
  } | null>(null);

  const [coins, setCoins] = useState(() => {
    const saved = safeStorage.getItem('block_blast_coins');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = safeStorage.getItem('block_blast_save');
    let startScore = 0;
    if (saved) {
      try { startScore = JSON.parse(saved).score; } catch (e) {}
    }
    return getLevelProgress(startScore).level;
  });

  const [initialized, setInitialized] = useState(false);

  // Initialize
  useEffect(() => {
    const savedHighScore = safeStorage.getItem('block_blast_high_score');
    const localHighScore = savedHighScore ? parseInt(savedHighScore, 10) : 0;
    if (savedHighScore) setHighScore(localHighScore);
    
    // Core Synchronized Global Score Loader - Keeps scores synchronized across simulator frames & tabs!
    import('../utils/firebase').then(({ db, currentUser }) => {
      if (currentUser) {
        import('firebase/firestore').then(({ doc, getDoc, setDoc }) => {
          getDoc(doc(db, "users", currentUser.uid)).then((docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data.highScore) {
                const globalHighScore = parseInt(data.highScore, 10);
                const finalMax = Math.max(globalHighScore, localHighScore);
                setHighScore(finalMax);
                safeStorage.setItem('block_blast_high_score', finalMax.toString());
                
                if (localHighScore > globalHighScore) {
                  const uname = safeStorage.getItem('block_blast_username');
                  setDoc(doc(db, "users", currentUser.uid), {
                    username: uname,
                    username_lower: (uname || '').toLowerCase(),
                    highScore: finalMax,
                    score: Math.max(data.score || 0, score)
                  }, { merge: true });
                }
              }
            }
          });
        });
      }
    });
    
    const saved = safeStorage.getItem('block_blast_save');
    if (!saved) {
      generateNewShapes();
    } else {
        try {
            const parsed = JSON.parse(saved);
            if (!parsed.availableShapes || parsed.availableShapes.every((s: any) => s === null)) {
                generateNewShapes();
            }
        } catch(e) {
            generateNewShapes();
        }
    }
    setInitialized(true);
  }, []);

  // Save to local storage on change
  useEffect(() => {
    if (initialized && !isGameOverStatus) {
        safeStorage.setItem('block_blast_save', JSON.stringify({
            grid,
            score,
            availableShapes
        }));
    }
  }, [grid, score, availableShapes, initialized, isGameOverStatus]);

  const [levelUpData, setLevelUpData] = useState<{level: number, coins: number, unlock?: string} | null>(null);

  useEffect(() => {
    const newLevel = getLevelProgress(score).level;
    if (newLevel > currentLevel) {
       setCurrentLevel(newLevel);
       const rewardCoins = 50;
       setCoins(c => {
         const newCoins = c + rewardCoins;
         safeStorage.setItem('block_blast_coins', newCoins.toString());
         return newCoins;
       });
       
       let unlockItem = undefined;
       if (newLevel === 2) unlockItem = 'Bomb Power-up';
       else if (newLevel === 3) unlockItem = 'Hint Power-up';
       else if (newLevel === 4) unlockItem = 'Replace Power-up';

       setLevelUpData({ level: newLevel, coins: rewardCoins, unlock: unlockItem });
       // addPopup(`Level ${newLevel}! +50 🪙`, window.innerWidth / 2, window.innerHeight / 2, '#FFD700');
    }
  }, [score, currentLevel]);

  const saveHighScore = (newScore: number) => {
    if (newScore > highScore) {
      setHighScore(newScore);
      safeStorage.setItem('block_blast_high_score', newScore.toString());
    }
  };

  const addPopup = (text: string, x: number, y: number, color: string = '#ffffff') => {
    const id = Date.now().toString() + Math.random().toString();
    setPopups((prev) => [...prev, { id, text, x, y, color }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter(p => p.id !== id));
    }, 1500);
  };

  const checkFits = (shape: ShapeDef, targetGrid: GridCellData[][], gridX: number, gridY: number): boolean => {
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (shape.matrix[r][c] === 1) {
          const rY = gridY + r;
          const cX = gridX + c;
          if (rY < 0 || rY >= GRID_SIZE || cX < 0 || cX >= GRID_SIZE) return false; // out of bounds
          if (targetGrid[rY][cX].isFilled) return false; // overlap
        }
      }
    }
    return true;
  };

  const checkAnyFits = (shapes: (ShapeDef | null)[], currentGrid: GridCellData[][]): boolean => {
    const activeShapes = shapes.filter(s => s !== null) as ShapeDef[];
    if (activeShapes.length === 0) return true; // empty means we will generate new ones
    for (const shape of activeShapes) {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (checkFits(shape, currentGrid, c, r)) return true;
        }
      }
    }
    return false;
  };

  const generateSmartShapes = (currentGrid: GridCellData[][]): (ShapeDef | null)[] => {
    // Count current filled blocks to calculate board density
    let filledCount = 0;
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (currentGrid[r][c].isFilled) filledCount++;
      }
    }
    const totalCells = GRID_SIZE * GRID_SIZE;
    const fillRatio = filledCount / totalCells;

    // Filter shapes dynamically based on density. If density is high (> 40%), we supply smaller, easier shapes (<= 3 blocks)!
    let candidates = SHAPES_LIBRARY;
    if (fillRatio > 0.40) {
      candidates = SHAPES_LIBRARY.filter(s => {
        let size = 0;
        for (let r = 0; r < s.matrix.length; r++) {
          for (let c = 0; c < s.matrix[r].length; c++) {
            if (s.matrix[r][c] === 1) size++;
          }
        }
        return size <= 3; // Filter to smaller, highly-flexible pieces
      });
    }
    
    if (candidates.length === 0) candidates = SHAPES_LIBRARY;

    const getRandomWithColor = () => {
      const base = candidates[Math.floor(Math.random() * candidates.length)];
      const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
      return { ...base, colorClass: color };
    };

    // Attempt to generate 3 candidates
    let generated: (ShapeDef | null)[] = [
      getRandomWithColor(),
      getRandomWithColor(),
      getRandomWithColor()
    ];

    // Guarantee that at least 2 shapes fit on current grid to avoid deadlocks
    let attempts = 0;
    while (attempts < 50 && !checkAnyFits(generated, currentGrid)) {
      attempts++;
      generated = [
        getRandomWithColor(),
        getRandomWithColor(),
        getRandomWithColor()
      ];
    }
    if (!checkAnyFits(generated, currentGrid)) {
      const singletonSymbol = SHAPES_LIBRARY.find(s => {
         return s.matrix.length === 1 && s.matrix[0].length === 1 && s.matrix[0][0] === 1;
      });
      if (singletonSymbol) {
         generated[0] = singletonSymbol;
         // Make another slot is simple also
         generated[1] = candidates[Math.floor(Math.random() * candidates.length)];
      }
    }

    return generated;
  };

  const generateNewShapes = useCallback(() => {
    setAvailableShapes(generateSmartShapes(grid));
  }, [grid]);
  useEffect(() => {
     if (clearingRows.length === 0 && clearingCols.length === 0) {
        const anyFits = checkAnyFits(availableShapes, grid);
        if (!anyFits) {
           const hasPieces = availableShapes.some(s => s !== null);
           if (hasPieces && !isGameOverStatus && hasRescuedCount < 2) {
              // FORGIVING MODE: Auto-clear some space if stuck!
              setHasRescuedCount(prev => prev + 1);
              sound.playBomb();
              addPopup('LEVEL SAVED!', 180, 300, '#10b981');
              
              setGrid(prev => {
                const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
                // Clear 3x3 block in the middle to give breathing room
                for (let r = 2; r < 5; r++) {
                  for (let c = 2; c < 5; c++) {
                    newGrid[r][c].occupied = false;
                    newGrid[r][c].colorClass = '';
                  }
                }
                return newGrid;
              });
              return;
           }

           if (!isGameOverStatus) {
              setIsGameOverStatus(true);
              safeStorage.removeItem('block_blast_save');
           }
        } else {
           if (isGameOverStatus) {
              setIsGameOverStatus(false);
           }
        }
     }
  }, [availableShapes, grid, clearingRows, clearingCols, isGameOverStatus, hasRescuedCount]);

  const spendCoins = (amount: number): boolean => {
    if (coins >= amount) {
      setCoins(c => {
        const newCoins = c - amount;
        safeStorage.setItem('block_blast_coins', newCoins.toString());
        return newCoins;
      });
      return true;
    }
    return false;
  };

  const triggerBomb = (r: number, c: number) => {
    sound.playBomb();
    setGrid(prev => {
      const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const rr = r + i;
          const cc = c + j;
          if (rr >= 0 && rr < GRID_SIZE && cc >= 0 && cc < GRID_SIZE) {
            newGrid[rr][cc] = { isFilled: false, colorClass: null };
          }
        }
      }
      return newGrid;
    });

    const screenX = c * 45 + 50;
    const screenY = r * 45 + 150;
    addPopup('BOOM!', screenX, screenY, '#ef4444');
    sound.vibrate([200, 50, 200]);
  };

  const triggerReverse = (): boolean => {
    if (!history) return false;
    setGrid(history.grid);
    setAvailableShapes(history.availableShapes);
    setScore(history.score);
    setComboCount(history.comboCount);
    setHistory(null);
    sound.playClear();
    return true;
  };

  const rerollShape = (index: number) => {
    setAvailableShapes(prev => {
      const next = [...prev];
      const base = SHAPES_LIBRARY[Math.floor(Math.random() * SHAPES_LIBRARY.length)];
      const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
      next[index] = { ...base, colorClass: color };
      return next;
    });
  };

  const getHint = (): { r: number, c: number, shapeIndex: number } | null => {
    for (let shapeIndex = 0; shapeIndex < availableShapes.length; shapeIndex++) {
       const shape = availableShapes[shapeIndex];
       if (shape) {
         for (let r = 0; r < GRID_SIZE; r++) {
           for (let c = 0; c < GRID_SIZE; c++) {
             if (checkFits(shape, grid, c, r)) return { r, c, shapeIndex };
           }
         }
       }
    }
    return null;
  };


  const placeShape = (shapeIndex: number, gridX: number, gridY: number, screenX: number, screenY: number): boolean => {
    const shape = availableShapes[shapeIndex];
    if (!shape || !checkFits(shape, grid, gridX, gridY)) return false;

    // Save for Undo/Reverse
    setHistory({
      grid: grid.map(row => row.map(cell => ({ ...cell }))),
      availableShapes: [...availableShapes],
      score,
      comboCount
    });

    // Apply block to grid
    let blocksPlaced = 0;
    const newPlaced: {r: number, c: number}[] = [];
    const newGrid = grid.map(row => [...row]);
    for (let r = 0; r < shape.matrix.length; r++) {
      for (let c = 0; c < shape.matrix[r].length; c++) {
        if (shape.matrix[r][c] === 1) {
          newGrid[gridY + r][gridX + c] = { isFilled: true, colorClass: shape.colorClass };
          newPlaced.push({r: gridY + r, c: gridX + c});
          blocksPlaced++;
        }
      }
    }

    setPlacedCoords(newPlaced);
    setTimeout(() => setPlacedCoords([]), 300);

    // Base score for placing blocks
    let earnedScore = blocksPlaced; // small flat score base

    // Find clears
    const fullRows: number[] = [];
    const fullCols: number[] = [];

    for (let r = 0; r < GRID_SIZE; r++) {
      if (newGrid[r].every(cell => cell.isFilled)) fullRows.push(r);
    }
    for (let c = 0; c < GRID_SIZE; c++) {
      let isFull = true;
      for (let r = 0; r < GRID_SIZE; r++) {
        if (!newGrid[r][c].isFilled) {
          isFull = false; break;
        }
      }
      if (isFull) fullCols.push(c);
    }

    const linesCleared = fullRows.length + fullCols.length;

    setAvailableShapes(prev => {
      const next = [...prev];
      next[shapeIndex] = null;
      return next;
    });

    if (linesCleared > 0) {
      setClearingRows(fullRows);
      setClearingCols(fullCols);

      const colorGrid = newGrid.map((row, rIdx) => 
         row.map((cell, cIdx) => {
          if (fullRows.includes(rIdx) || fullCols.includes(cIdx)) {
            return { ...cell, colorClass: shape.colorClass };
          }
          return cell;
        })
      );
      setGrid(colorGrid);

      // Moderate score bonus to prevent runaway high scores
      const newCombo = comboCount + 1;
      setComboCount(newCombo);
      
      // Standard Tetris-like scoring but with dynamic combo multipliers
      const baseLinePoints = [0, 100, 300, 500, 800]; // Bonus for clearing 1, 2, 3, or 4+ lines
      const lineBonus = baseLinePoints[Math.min(linesCleared, 4)] || 1000;
      
      earnedScore += Math.round(lineBonus * (1 + newCombo * 0.2));

      // Popups & dynamic speak effects for game voices
      let text = 'Good!';
      let color = '#38bdf8'; // light blue

      if (linesCleared === 2) {
         text = 'Sweet!';
         color = '#10b981'; // Green accent
      } else if (linesCleared === 3) {
         text = 'Amazing!';
         color = '#ec4899'; // Pink accent
      } else if (linesCleared >= 4) {
         text = 'Unbelievable!';
         color = '#f59e0b'; // Amber gold
      }

      if (newCombo > 1) {
        addPopup(text, screenX, screenY - 50, color);
        addPopup(`Combo ${newCombo}`, screenX, screenY - 80, '#FFD700');
        addPopup(`+${earnedScore}`, screenX, screenY + 20, '#facc15');
      } else {
        addPopup(text, screenX, screenY - 50, color);
        addPopup(`+${earnedScore}`, screenX, screenY + 20, '#facc15');
      }

      // Actually clear them after animation
      setTimeout(() => {
        setGrid(currentGrid => {
          const clearedGrid = currentGrid.map((row, rIdx) => 
            row.map((cell, cIdx) => {
              if (fullRows.includes(rIdx) || fullCols.includes(cIdx)) {
                return { isFilled: false, colorClass: null };
              }
              return cell;
            })
          );
          
          // Re-check for new shape gen if out
          setAvailableShapes(currentShapes => {
              const active = currentShapes.filter(s => s !== null);
              if (active.length === 0) {
                return generateSmartShapes(clearedGrid);
              }
              return currentShapes;
          });
          return clearedGrid;
        });
        setClearingRows([]);
        setClearingCols([]);
      }, 400);

    } else {
      setComboCount(0); // Break combo
      setGrid(newGrid);
      
      setAvailableShapes(currentShapes => {
         const active = currentShapes.filter(s => s !== null);
         if (active.length === 0) {
            return generateSmartShapes(newGrid);
         }
         return currentShapes;
      });
    }

    setScore(prevScore => {
       const newTotalScore = prevScore + earnedScore;
       setHighScore(prevHS => {
            const max = Math.max(prevHS, newTotalScore);
            safeStorage.setItem('block_blast_high_score', max.toString());
            // Sync to Firebase on highscore updates
            import('../utils/firebase').then(({ db, currentUser }) => {
              if (currentUser) {
                import('firebase/firestore').then(({ doc, setDoc }) => {
                  const uname = safeStorage.getItem('block_blast_username') || '@guest';
                  setDoc(doc(db, "users", currentUser.uid), {
                    username: uname,
                    username_lower: uname.toLowerCase(),
                    highScore: max,
                    score: newTotalScore,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                });
              }
            });
            return max;
       });
       return newTotalScore;
    });

    return true; // successful placement
  };

  const resetGame = () => {
    setGrid(createEmptyGrid());
    setScore(0);
    setComboCount(0);
    setIsGameOverStatus(false);
    setHasRescuedCount(0);
    setCurrentLevel(1);
    safeStorage.removeItem('block_blast_save');
    generateNewShapes();
  }

  return {
    grid,
    availableShapes,
    score,
    highScore,
    comboCount,
    clearingRows,
    clearingCols,
    popups,
    isGameOverStatus,
    placedCoords,
    coins,
    currentLevel,
    levelUpData,
    setLevelUpData,
    spendCoins,
    triggerBomb,
    triggerReverse,
    rerollShape,
    getHint,
    placeShape,
    checkFits,
    checkAnyFits,
    generateNewShapes,
    setAvailableShapes,
    resetGame,
  };
}
