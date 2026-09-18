import { HISTORY_CARD_TYPES, TALENT_COUNTS } from '../../shared/constants.js';
import type { Card, CardType, HistoryCard } from '../../shared/types.js';
import { uid } from '../../shared/utils.js';

const STARTING_TYPES:CardType[]=['Farmland','Strategist','Cavalry','Banner','Pass','City','Wanderer'];

export function shuffle<T>(items:T[]):T[]{
  const copy=[...items];
  for(let i=copy.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [copy[i],copy[j]]=[copy[j],copy[i]];
  }
  return copy;
}

export function createTalentStacks(playerCount:number, gridSize:number){
  const cards:Card[]=[];
  for(const [type,count] of Object.entries(TALENT_COUNTS[playerCount])){
    for(let i=0;i<(count ?? 0);i++) cards.push({id:uid(type.toLowerCase()),type:type as CardType});
  }
  const deck=shuffle(cards);
  const perStack=deck.length/gridSize;
  return Array.from({length:gridSize},(_,i)=>({col:i+1,cards:deck.slice(i*perStack,(i+1)*perStack)}));
}

export function wasteland(col:number):Card{ return {id:uid(`wasteland-${col}`),type:'Wasteland'}; }
export function randomStartingCard():Card{ const type=STARTING_TYPES[Math.floor(Math.random()*STARTING_TYPES.length)]; return {id:uid(type.toLowerCase()),type}; }
export function createHistoryCards(enabled:boolean):HistoryCard[]{ return enabled ? shuffle(HISTORY_CARD_TYPES).slice(0,2).map(type=>({id:uid(type),type,used:false})) : []; }
