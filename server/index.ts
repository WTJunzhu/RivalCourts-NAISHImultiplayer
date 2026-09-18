import express from 'express';
import { createServer } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { initDb } from './db/client.js';
import { attachWsServer } from './ws/WsServer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app=express();
app.use(express.json());
app.get('/health',(_,res)=>res.json({ok:true,name:'Rival Courts server'}));

// Only serve client static files when bundled together (e.g. Railway).
// On Render the client is hosted separately on Vercel, so skip this.
const clientDist = join(__dirname, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_,res) => res.sendFile(join(clientDist, 'index.html')));
}

const server=createServer(app);
const rooms=attachWsServer(server);
const port=Number(process.env.PORT??8787);

initDb()
  .then(()=>rooms.init())
  .then(()=>server.listen(port,()=>console.log(`Rival Courts server listening on :${port}`)))
  .catch(err=>{ console.error('startup error',err); process.exit(1); });
