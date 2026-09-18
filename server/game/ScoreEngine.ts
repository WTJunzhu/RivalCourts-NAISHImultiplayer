import type { Card, CardType, PlayerState, Zone } from '../../shared/types.js';
import { centerCol, isAdjacent } from '../../shared/utils.js';

function cardsOf(player:PlayerState){ return [...player.mingTang.map((card,i)=>({card,zone:'mingTang' as Zone,col:i+1})),...player.anShi.map((card,i)=>({card,zone:'anShi' as Zone,col:i+1}))]; }
function adjacentToLord(player:PlayerState,zone:Zone,col:number){ return cardsOf(player).some(n=>n.card.type==='Lord'&&isAdjacent(zone,col,n.zone,n.col)); }
function wastelandScore(count:number){ if(count===0) return 0; if(count===1) return 5; if(count===2) return -5; return -15; }
function passScore(count:number){ if(count===0) return 0; if(count===1) return -5; if(count===2) return 0; return 30; }
function bannerScore(player:PlayerState){ const count=player.mingTang.filter(c=>c.type==='Banner').length; if(count===0)return 0; if(count===1)return 3; if(count===2)return 8; return 15; }
function strategistScore(col:number,gridSize:number,adjacent:boolean){ const lordCol=centerCol(gridSize); const d=Math.min(Math.abs(col-(lordCol-1)),Math.abs(col-(lordCol+1))); return Math.max(2,5-d)+(adjacent?6:0); }
function cityScore(player:PlayerState,zone:Zone,col:number,gridSize:number){ let score=col===1||col===gridSize ? 10 : -5; for(const n of cardsOf(player)){ if((n.card.type==='Banner'||n.card.type==='Cavalry')&&isAdjacent(zone,col,n.zone,n.col)) score+=4; } return score; }
function farmlandScore(player:PlayerState){ const nodes=cardsOf(player).filter(n=>n.card.type==='Farmland'); const seen=new Set<string>(); let total=0; for(const node of nodes){ const key=`${node.zone}-${node.col}`; if(seen.has(key)) continue; const q=[node]; seen.add(key); let size=0; while(q.length){ const cur=q.shift()!; size++; for(const next of nodes){ const nk=`${next.zone}-${next.col}`; if(!seen.has(nk)&&isAdjacent(cur.zone,cur.col,next.zone,next.col)){ seen.add(nk); q.push(next); } } } if(size===2) total+=10; else if(size===3) total+=20; else if(player.nation==='楚'&&size>=5) total+=40; else if(size>=4) total+=30; } return total; }
function wandererScore(player:PlayerState){ const count=player.anShi.filter(c=>c.type==='Wanderer').length; if(count===0) return 0; const types=new Set(player.anShi.map(c=>c.type).filter(t=>t!=='Wasteland')); return count*(5+5*types.size+(player.nation==='燕'?3*types.size:0)); }
export function scorePlayer(player:PlayerState,gridSize:number):number{
  let score=0; const all=cardsOf(player); const counts=(type:CardType)=>all.filter(n=>n.card.type===type).length;
  score+=wastelandScore(counts('Wasteland'))+passScore(counts('Pass'))+bannerScore(player)+farmlandScore(player)+wandererScore(player);
  for(const n of all){
    if(n.card.type==='Strategist') score+=strategistScore(n.col,gridSize,adjacentToLord(player,n.zone,n.col));
    if(n.card.type==='Lord') score+=player.nationDeclared&&n.zone==='mingTang'&&n.col===centerCol(gridSize)?0:(n.zone==='mingTang'&&n.col===centerCol(gridSize)?12:4);
    if(n.card.type==='Cavalry'&&n.zone==='anShi'){ const base=player.mingTang[n.col-1]?.type==='Banner'?10:3; score+=player.nation==='赵'?base*2:base; }
    if(n.card.type==='City') score+=cityScore(player,n.zone,n.col,gridSize);
  }
  if(player.nation==='韩') score+=all.filter(n=>['Farmland','Pass','City','Banner'].includes(n.card.type)).length*2;
  return score+player.warBonus+player.compensationBonus-player.warPenalties;
}
export function scoreGame(players:PlayerState[],gridSize:number){ return Object.fromEntries(players.map(p=>[p.id,scorePlayer(p,gridSize)])); }
