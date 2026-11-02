import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../server/store.mjs';
if(process.env.NODE_ENV==='production'&&!process.env.DATA_DIR)throw new Error('DATA_DIR is required.');
const store=new Store(process.env.DATA_DIR||'./data');
const destination=join(store.dir,'backups',new Date().toISOString().replaceAll(':','-'));
mkdirSync(join(destination,'tenants'),{recursive:true,mode:0o700});
try {
  store.platform.prepare('VACUUM INTO ?').run(join(destination,'platform.db'));
  for(const t of store.listTenants().filter(t=>['active','suspended'].includes(t.status)))store.tenant(t.id).prepare('VACUUM INTO ?').run(join(destination,'tenants',`${t.id}.db`));
  console.log(`SQLite snapshots saved to ${destination}. Stop writes for a consistent multi-database recovery set; copy backups off the volume.`);
}finally{store.close();}
