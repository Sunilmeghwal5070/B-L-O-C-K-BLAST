import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShapeDef } from '../types';

export function PreviewShape({ shape, className, cellSize = 20 }: { shape: ShapeDef, className?: string, cellSize?: number }) {
  if (!shape) return null;
  
  const rows = shape.matrix.length;
  const cols = shape.matrix[0].length;

  return (
    <div 
      className={`grid gap-[1px] ${className || ''}`} 
      style={{ 
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`
      }}
    >
      {shape.matrix.map((row, rI) => 
        row.map((val, cI) => (
          <div 
            key={`${rI}-${cI}`} 
            className={`w-full h-full rounded-[3px] ${val ? shape.colorClass + ' block-cell' : 'opacity-0'}`}
          />
        ))
      )}
    </div>
  );
}
