import express from 'express';
import { createServer } from 'node:http';
import { initDb } from './db/client.js';
import { attachWsServer } from './ws/WsServer.js';

const app=express();
app.use(express.json());
app.get('/health',(_,res)=>res.json({ok:true,name:'Rival Courts server'}));

const server=createServer(app);
const rooms=attachWsServer(server);
const port=Number(process.env.PORT??8787);

initDb()
  .then(()=>rooms.init())
  .then(()=>server.listen(port,()=>console.log(`Rival Courts server listening on :${port}`)))
  .catch(err=>{ console.error('startup error',err); process.exit(1); });
