import type { GameState, PlayerState, Zone } from './types.js';
export function mirrorCol(col:number, gridSize:number):number { return gridSize + 1 - col; }
export function centerCol(gridSize:number):number { return Math.ceil(gridSize / 2); }
export function isAdjacent(zoneA:Zone,colA:number,zoneB:Zone,colB:number):boolean { return zoneA===zoneB ? Math.abs(colA-colB)===1 : colA===colB; }
export function uid(prefix='id'):string { return `${prefix}-${Math.random().toString(36).slice(2,9)}-${Date.now().toString(36)}`; }
export function currentPlayer(state:GameState):PlayerState { return state.players.find(p=>p.id===state.turnOrder[state.currentPlayerIndex])!; }
export function topTalent(state:GameState,col:number){ return state.talent[col-1]?.cards[0]; }
export function markExhausted(state:GameState):void { state.stacksExhausted=state.talent.filter(s=>s.cards.length===0).length; }
export function normalizeCol(col:number,gridSize:number):number { if(!Number.isInteger(col)||col<1||col>gridSize) throw new Error('位置超出棋盘范围'); return col; }
