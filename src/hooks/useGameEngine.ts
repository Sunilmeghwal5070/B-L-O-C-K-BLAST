import { useState, useCallback, useEffect } from 'react';
import { GridCellData, ShapeDef, Pos, PopupText } from '../types';
import { SHAPES_LIBRARY, GRID_SIZE } from '../constants';

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

    const saved = localStorage.getItem('block_blast_save');
    if (saved) {
      try { return JSON.parse(saved).grid; } catch (e) {}
    }
    return createEmptyGrid();
  });
  const [score, setScore] = useState(() => {
    const saved = localStorage.getItem('block_blast_save');
    if (saved) {
      try { return JSON.parse(saved).score; } catch (e) {}
    }
    return 0;
  });
  const [highScore, setHighScore] = useState(0);
  const [availableShapes, setAvailableShapes] = useState<(ShapeDef | null)[]>(() => {
    const saved = localStorage.getItem('block_blast_save');
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
  const [placedCoords, setPlacedCoords] = useState<{r: number, c: number}[]>([]);

  const [coins, setCoins] = useState(() => {
    const saved = localStorage.getItem('block_blast_coins');
    return saved ? parseInt(saved, 10) : 0;
  });

  const [currentLevel, setCurrentLevel] = useState(() => {
    const saved = localStorage.getItem('block_blast_save');
    let startScore = 0;
    if (saved) {
      try { startScore = JSON.parse(saved).score; } catch (e) {}
    }
    return getLevelProgress(startScore).level;
  });

  const [initialized, setInitialized] = useState(false);

  // Initialize
  useEffect(() => {
    const savedHighScore = localStorage.getItem('block_blast_high_score');
    if (savedHighScore) setHighScore(parseInt(savedHighScore, 10));
    
    const saved = localStorage.getItem('block_blast_save');
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
        localStorage.setItem('block_blast_save', JSON.stringify({
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
         localStorage.setItem('block_blast_coins', newCoins.toString());
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
      localStorage.setItem('block_blast_high_score', newScore.toString());
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
    let generated: (ShapeDef | null)[] = [
      SHAPES_LIBRARY[Math.floor(Math.random() * SHAPES_LIBRARY.length)],
      SHAPES_LIBRARY[Math.floor(Math.random() * SHAPES_LIBRARY.length)],
      SHAPES_LIBRARY[Math.floor(Math.random() * SHAPES_LIBRARY.length)]
    ];

    if (!checkAnyFits(generated, currentGrid)) {
      if (Math.random() < 0.90) { // 90% chance to save the player
         const fittingShapes = SHAPES_LIBRARY.filter(shape => {
           for (let r = 0; r < GRID_SIZE; r++) {
             for (let c = 0; c < GRID_SIZE; c++) {
               if (checkFits(shape, currentGrid, c, r)) return true;
             }
           }
           return false;
         });
         
         if (fittingShapes.length > 0) {
            generated[Math.floor(Math.random() * 3)] = fittingShapes[Math.floor(Math.random() * fittingShapes.length)];
         }
      }
    }

    return generated;
  };

  const generateNewShapes = useCallback(() => {
    setAvailableShapes(generateSmartShapes(grid));
  }, [grid]);
  useEffect(() => {
     if (clearingRows.length === 0 && clearingCols.length === 0) {
        if (!checkAnyFits(availableShapes, grid)) {
           if (!isGameOverStatus) {
              setIsGameOverStatus(true);
              localStorage.removeItem('block_blast_save');
           }
        } else {
           if (isGameOverStatus) {
              setIsGameOverStatus(false);
           }
        }
     }
  }, [availableShapes, grid, clearingRows, clearingCols, isGameOverStatus]);

  const spendCoins = (amount: number): boolean => {
    if (coins >= amount) {
      setCoins(c => {
        const newCoins = c - amount;
        localStorage.setItem('block_blast_coins', newCoins.toString());
        return newCoins;
      });
      return true;
    }
    return false;
  };

  const triggerBomb = (r: number, c: number) => {
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
    // Add some visual effects via placedCoords for particles, maybe manually trigger them? We will handle visually in component.
  };

  const rerollShape = (index: number) => {
    setAvailableShapes(prev => {
      const next = [...prev];
      next[index] = SHAPES_LIBRARY[Math.floor(Math.random() * SHAPES_LIBRARY.length)];
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

      // Score calc based on screenshots: 
      // +10 flat for piece, +10 or 20 for multiple pieces. A "Good!" often gives +20 or +30 or +40 depending on lines and combo
      const newCombo = comboCount + 1;
      setComboCount(newCombo);
      earnedScore += (linesCleared * 10) * newCombo;

      // Popups
      let text = 'Good!';
      let color = '#38bdf8'; // light blue

      if (linesCleared === 2) {
         text = 'Awesome!';
         color = '#a855f7'; // purple
      } else if (linesCleared === 3) {
         text = 'Super!';
         color = '#f97316'; // orange
      } else if (linesCleared >= 4) {
         text = 'PERFECT!';
         color = '#ef4444'; // red
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
           localStorage.setItem('block_blast_high_score', max.toString());
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
    setCurrentLevel(1);
    localStorage.removeItem('block_blast_save');
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
