import { Store } from '../server/store.mjs';
if(process.env.NODE_ENV==='production'&&!process.env.DATA_DIR)throw new Error('DATA_DIR is required.');
const store=new Store(process.env.DATA_DIR||'./data');
console.log(`Migrations complete for platform and ${store.listTenants().filter(t=>['active','suspended'].includes(t.status)).length} tenant databases.`);
store.close();
