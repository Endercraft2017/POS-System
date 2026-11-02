import {writeFileSync} from 'node:fs';
import {Store} from '../server/store.mjs';
import {makeBackup} from '../server/backups.mjs';
if(process.env.NODE_ENV==='production'&&!process.env.DATA_DIR)throw Error('DATA_DIR required.');
const destination=process.argv[2];if(!destination)throw Error('Usage: BACKUP_KEY=… npm run backup -- recovery.relaxbk (stop the server first, or use console download)');
const store=new Store(process.env.DATA_DIR||'./data');
try{writeFileSync(destination,makeBackup(store,process.env.BACKUP_KEY),{mode:0o600,flag:'wx'});console.log('Encrypted recovery copy saved. Keep it off the data volume; retain the key separately.');}finally{store.close();}
