import { getDb } from './client.js';
import type { GameOptions, GameState } from '../../shared/types.js';

export async function saveRoom(code:string,hostId:string,options:GameOptions,players:{id:string;name:string}[]):Promise<void>{
  const db=getDb(); if(!db) return;
  await db.execute({sql:'INSERT OR REPLACE INTO rooms (code,host_id,options,player_list,created_at) VALUES (?,?,?,?,?)',args:[code,hostId,JSON.stringify(options),JSON.stringify(players),Date.now()]});
}

export async function loadAllRooms():Promise<{code:string;hostId:string;options:GameOptions;players:{id:string;name:string}[]}[]>{
  const db=getDb(); if(!db) return [];
  const r=await db.execute('SELECT code,host_id,options,player_list FROM rooms');
  return r.rows.map(row=>({code:String(row.code),hostId:String(row.host_id),options:JSON.parse(String(row.options)) as GameOptions,players:JSON.parse(String(row.player_list))}));
}

export async function saveSnapshot(code:string,state:GameState):Promise<void>{
  const db=getDb(); if(!db) return;
  await db.execute({sql:'INSERT OR REPLACE INTO game_snapshots (code,state,updated_at) VALUES (?,?,?)',args:[code,JSON.stringify(state),Date.now()]});
}

export async function loadSnapshot(code:string):Promise<GameState|null>{
  const db=getDb(); if(!db) return null;
  const r=await db.execute({sql:'SELECT state FROM game_snapshots WHERE code=?',args:[code]});
  if(!r.rows[0]) return null;
  return JSON.parse(String(r.rows[0].state)) as GameState;
}
