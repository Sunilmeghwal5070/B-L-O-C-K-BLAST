import { ShapeDef } from './types';

// Define the comprehensive library of block shapes inspired by screenshots.
export const SHAPES_LIBRARY: ShapeDef[] = [
  // 1x1
  { id: '1x1', matrix: [[1]], colorClass: 'block-yellow' },
  // 2x2
  { id: 'sq_2x2', matrix: [[1,1],[1,1]], colorClass: 'block-blue' },
  // 3x3
  { id: 'sq_3x3', matrix: [[1,1,1],[1,1,1],[1,1,1]], colorClass: 'block-orange' },
  
  // Lines (Horizontal)
  { id: 'line_h_2', matrix: [[1,1]], colorClass: 'block-purple' },
  { id: 'line_h_3', matrix: [[1,1,1]], colorClass: 'block-purple' },
  { id: 'line_h_4', matrix: [[1,1,1,1]], colorClass: 'block-cyan' },
  { id: 'line_h_5', matrix: [[1,1,1,1,1]], colorClass: 'block-cyan' },
  
  // Lines (Vertical)
  { id: 'line_v_2', matrix: [[1],[1]], colorClass: 'block-purple' },
  { id: 'line_v_3', matrix: [[1],[1],[1]], colorClass: 'block-purple' },
  { id: 'line_v_4', matrix: [[1],[1],[1],[1]], colorClass: 'block-cyan' },
  { id: 'line_v_5', matrix: [[1],[1],[1],[1],[1]], colorClass: 'block-cyan' },
  
  // Small L Shapes
  { id: 'l_sm_1', matrix: [[1,0],[1,1]], colorClass: 'block-orange' },
  { id: 'l_sm_2', matrix: [[0,1],[1,1]], colorClass: 'block-orange' },
  { id: 'l_sm_3', matrix: [[1,1],[1,0]], colorClass: 'block-orange' },
  { id: 'l_sm_4', matrix: [[1,1],[0,1]], colorClass: 'block-orange' },
  
  // Large L Shapes
  { id: 'l_lg_1', matrix: [[1,0,0],[1,0,0],[1,1,1]], colorClass: 'block-green' },
  { id: 'l_lg_2', matrix: [[0,0,1],[0,0,1],[1,1,1]], colorClass: 'block-green' },
  { id: 'l_lg_3', matrix: [[1,1,1],[1,0,0],[1,0,0]], colorClass: 'block-green' },
  { id: 'l_lg_4', matrix: [[1,1,1],[0,0,1],[0,0,1]], colorClass: 'block-green' },

  // Medium L Shapes
  { id: 'l_md_1', matrix: [[1,0],[1,0],[1,1]], colorClass: 'block-purple' },
  { id: 'l_md_2', matrix: [[1,1,1],[1,0,0]], colorClass: 'block-purple' },

  // T Shapes
  { id: 't_1', matrix: [[1,1,1],[0,1,0]], colorClass: 'block-yellow' },
  { id: 't_2', matrix: [[0,1,0],[1,1,1]], colorClass: 'block-red' },
  { id: 't_3', matrix: [[1,0],[1,1],[1,0]], colorClass: 'block-cyan' },
  { id: 't_4', matrix: [[0,1],[1,1],[0,1]], colorClass: 'block-cyan' },
  
  // Z/S Shapes
  { id: 'z_1', matrix: [[1,1,0],[0,1,1]], colorClass: 'block-red' },
  { id: 's_1', matrix: [[0,1,1],[1,1,0]], colorClass: 'block-green' },
  
  // Diagonals / Misc
  { id: 'diag_1', matrix: [[1,0,0],[0,1,0],[0,0,1]], colorClass: 'block-orange' },
];

export const GRID_SIZE = 8;
