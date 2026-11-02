import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app.mjs';
import { Store } from '../server/store.mjs';
import { migrate, tenantMigrations } from '../server/migrations.mjs';

const password='only-for-local-tests-123456';
async function fixture(t){
  const dir=mkdtempSync(join(tmpdir(),'relax-test-'));
  const app=await createApp({dataDir:dir,production:false,origins:[],consoleUsername:'owner',consolePassword:password});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.store.close();rmSync(dir,{recursive:true,force:true});});
  async function request(path,{method='GET',body,cookie,csrf,origin=base}={}){
    const response=await fetch(base+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    const text=await response.text();return{status:response.status,headers:response.headers,data:response.headers.get('content-type')?.includes('json')?JSON.parse(text):text};
  }
  async function login(prefix,username='owner'){
    const result=await request(prefix+'/login',{method:'POST',body:{username,password}});assert.equal(result.status,200);
    return{cookie:result.headers.get('set-cookie').split(';')[0],csrf:result.data.csrf};
  }
  return{...app,dir,request,login};
}
test('public routes expose the Relax site and demo; the operator API requires authentication',async t=>{
  const {request}=await fixture(t);
  assert.equal((await request('/api/health')).data.ok,true);
  assert.match((await request('/')).data,/More café/);
  assert.match((await request('/_console')).data,/Operator console/);
  assert.equal((await request('/_demo/')).status,200);
  assert.equal((await request('/_demo/app.mjs')).status,200);
  assert.equal((await request('/api/console/tenants')).status,401);
  assert.equal((await request('/unknown-cafe')).status,404);
  assert.equal((await request('/server/store.mjs')).status,404);
});
test('tenant setup, authentication, publishing, isolated data and suspension work together',async t=>{
  const {request,login,store,dir}=await fixture(t),operator=await login('/api/console');
  const create=async slug=>request('/api/console/tenants',{...operator,method:'POST',body:{slug,name:slug,username:'cafeowner',password}});
  assert.equal((await request('/api/console/tenants',{cookie:operator.cookie,method:'POST',body:{}})).status,403);
  assert.equal((await request('/api/console/tenants',{...operator,origin:'https://another-origin.example',method:'POST',body:{}})).status,403);
  assert.equal((await create('alpha-cafe')).status,201);
  assert.equal((await create('bravo-cafe')).status,201);
  assert.equal((await create('alpha-cafe')).status,409);
  assert.equal((await create('admin')).status,400);
  const alpha=await login('/api/cafes/alpha-cafe','cafeowner');
  const bravo=await login('/api/cafes/bravo-cafe','cafeowner');
  assert.equal((await request('/api/cafes/bravo-cafe/workspace',alpha)).status,401);
  assert.equal((await request('/api/console/tenants',alpha)).status,401);
  assert.equal((await request('/api/cafes/alpha-cafe/workspace',operator)).status,401);
  const workspace=await request('/api/cafes/alpha-cafe/workspace',alpha);
  assert.equal(workspace.data.products.length,0);assert.equal(workspace.data.branches.length,1);
  assert.equal((await request('/alpha-cafe')).status,404);
  assert.equal((await request('/api/cafes/alpha-cafe/products',{...alpha,method:'POST',body:{name:'Latte',category:'Coffee',description:'House espresso & milk',price:12000}})).status,201);
  assert.equal((await request('/api/cafes/bravo-cafe/workspace',bravo)).data.products.length,0);
  assert.equal((await request('/api/cafes/alpha-cafe/profile',{...alpha,method:'PATCH',body:{description:'A quiet corner.',address:'Quezon City',hours:'8 am–6 pm'}})).status,200);
  const patch={plan:'paid',status:'active',websiteEnabled:true,productLimit:25,locationLimit:2};
  assert.equal((await request('/api/console/tenants/alpha-cafe',{...operator,method:'PATCH',body:patch})).status,200);
  const publicPage=await request('/alpha-cafe');assert.equal(publicPage.status,200);assert.match(publicPage.data,/House espresso &amp; milk/);assert.match(publicPage.data,/Quezon City/);assert.doesNotMatch(publicPage.data,/password_hash/);
  assert.equal((await request('/api/cafes/alpha-cafe/branches',{...alpha,method:'POST',body:{name:'Second location'}})).status,201);
  const updated=(await request('/api/cafes/alpha-cafe/workspace',alpha)).data;assert.equal(updated.branches.length,2);
  const db=store.tenant(store.bySlug('alpha-cafe').id);assert.equal(db.prepare('SELECT COUNT(*) n FROM users').get().n,1);assert.equal(db.prepare('SELECT COUNT(*) n FROM memberships').get().n,2);
  assert.equal((await request('/api/console/tenants/alpha-cafe',{...operator,method:'PATCH',body:{...patch,plan:'free',websiteEnabled:false}})).status,409);
  assert.equal((await request('/api/console/tenants/alpha-cafe',{...operator,method:'PATCH',body:{...patch,status:'suspended'}})).status,200);
  assert.equal((await request('/alpha-cafe')).status,404);assert.equal((await request('/api/cafes/alpha-cafe/workspace',alpha)).status,404);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);
  assert.equal(readdirSync(join(dir,'tenants')).filter(f=>f.endsWith('.db')).length,2);
});
test('free product and location allowances are enforced; archiving frees an active slot',async t=>{
  const {request,login}=await fixture(t),operator=await login('/api/console');
  await request('/api/console/tenants',{...operator,method:'POST',body:{slug:'menu-cafe',name:'Menu café',username:'cafeowner',password}});
  const owner=await login('/api/cafes/menu-cafe','cafeowner');let first;
  for(let n=0;n<20;n++){const r=await request('/api/cafes/menu-cafe/products',{...owner,method:'POST',body:{name:`Item ${n}`,category:'Coffee',description:'',price:10000}});assert.equal(r.status,201);first ||= r.data.id;}
  const item={name:'One more',category:'Coffee',description:'',price:10000};
  assert.equal((await request('/api/cafes/menu-cafe/products',{...owner,method:'POST',body:item})).status,409);
  assert.equal((await request('/api/cafes/menu-cafe/branches',{...owner,method:'POST',body:{name:'Another branch'}})).status,409);
  assert.equal((await request('/api/console/tenants/menu-cafe',{...operator,method:'PATCH',body:{plan:'free',status:'active',websiteEnabled:true,productLimit:25,locationLimit:2}})).status,400);
  await request(`/api/cafes/menu-cafe/products/${first}`,{...owner,method:'PATCH',body:{active:false}});
  assert.equal((await request('/api/cafes/menu-cafe/products',{...owner,method:'POST',body:item})).status,201);
  assert.equal((await request(`/api/cafes/menu-cafe/products/${first}`,{...owner,method:'PATCH',body:{active:true}})).status,409);
});
test('tenant records persist across reopening, migrations are idempotent and missing data fails closed',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'relax-storage-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let store=new Store(dir);const tenant=await store.createTenant({slug:'persistent-cafe',name:'Persistent café',username:'cafeowner',password},'local-test');store.close();
  store=new Store(dir);assert.equal(store.bySlug(tenant.slug).id,tenant.id);assert.equal(store.tenant(tenant.id).prepare('SELECT COUNT(*) n FROM branches').get().n,1);store.close();
  store=new Store(dir);assert.equal(store.platform.prepare('SELECT COUNT(*) n FROM schema_migrations').get().n,1);store.close();
  rmSync(join(dir,'tenants',`${tenant.id}.db`));assert.throws(()=>new Store(dir),/database is missing/);
});
test('schema upgrades snapshot existing data and roll back a failing migration',t=>{
  const dir=mkdtempSync(join(tmpdir(),'relax-migration-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'tenant.db'),db=new DatabaseSync(file),snapshots=join(dir,'backups');t.after(()=>db.close());
  migrate(db,file,tenantMigrations,snapshots);db.prepare('UPDATE profile SET description=? WHERE id=1').run('Keep this data');
  assert.throws(()=>migrate(db,file,[...tenantMigrations,{version:tenantMigrations.at(-1).version+1,sql:'CREATE TABLE new_table(id INTEGER); INSERT INTO missing_table VALUES(1);'}],snapshots));
  assert.equal(db.prepare('SELECT description FROM profile').get().description,'Keep this data');assert.equal(db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='new_table'").get().n,0);assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get().n,tenantMigrations.at(-1).version);
  const snapshot=join(snapshots,readdirSync(snapshots)[0]);assert.ok(existsSync(snapshot));const restored=new DatabaseSync(snapshot);assert.equal(restored.prepare('SELECT description FROM profile').get().description,'Keep this data');restored.close();
});
