import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server/app.mjs';
import {Store} from '../server/store.mjs';
import {makeBackup,restoreBackup} from '../server/backups.mjs';

async function cafe(t){
  const dir=mkdtempSync(join(tmpdir(),'relax-ops-')),password='local-tests-only-password-123';
  const app=await createApp({dataDir:dir,production:false,origins:[],consoleUsername:'operator',consolePassword:password,monitorToken:'local-monitor-token-only'});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+app.server.address().port;
  t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});
  async function request(path,auth={},body,method=body?'POST':'GET'){
    const r=await fetch(url+path,{method,headers:{Origin:url,'Content-Type':'application/json',...(auth.cookie?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{}),...(auth.bearer?{Authorization:'Bearer '+auth.bearer}:{})},body:body?JSON.stringify(body):undefined});
    const text=await r.text();return{status:r.status,headers:r.headers,data:r.headers.get('content-type')?.includes('json')?JSON.parse(text):text};
  }
  const login=async(prefix,username)=>{const r=await request(prefix+'/login',{}, {username,password});assert.equal(r.status,200);return{cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.data.csrf};};
  const operator=await login('/api/console','operator');assert.equal((await request('/api/console/tenants',operator,{slug:'test-cafe',name:'Test café',username:'owner',password})).status,201);
  const prefix='/api/cafes/test-cafe',owner=await login(prefix,'owner'),branchId=(await request(prefix+'/workspace',owner)).data.branches[0].id;
  const send=(path,body,method='POST')=>request(prefix+path,owner,{operationId:randomUUID(),...body},method);
  const milk=await send('/ingredients',{name:'Milk',unit:'mL',lowMilli:100000,unitCost:1});assert.equal(milk.status,201);
  assert.equal((await send('/stock',{branchId,ingredientId:milk.data.id,kind:'opening',quantityMilli:1000000,reason:'Counted opening stock'})).status,201);
  const product={name:'Latte',category:'Coffee',description:'House drink',price:12000,recipe:[{ingredientId:milk.data.id,quantityMilli:100000}],options:{trackStock:true,sizes:[{id:'large',label:'Large',price:15000,recipe:[{ingredientId:milk.data.id,quantityMilli:150000}]}],addons:[{id:'milk',label:'Extra milk',price:2000,recipe:[{ingredientId:milk.data.id,quantityMilli:50000}]}],modifiers:[{id:'temp',label:'Temperature',choices:['Hot','Iced']}]}};
  const p=await send('/products',product);assert.equal(p.status,201);
  const checkout={branchId,lines:[{productId:p.data.id,sizeId:'large',addonIds:['milk'],modifiers:{temp:'Iced'},quantity:2,note:'Less ice'}],method:'cash',cashTendered:40000,expectedTotal:34000,note:'Pickup'};
  return{...app,dir,request,operator,owner,prefix,branchId,milk:milk.data.id,productId:p.data.id,product,checkout,send,db:app.store.tenant(app.store.bySlug('test-cafe').id)};
}
test('encrypted recovery restores orders, stock and retry receipts, rejects tampering and invalidates sessions',async t=>{
 const f=await cafe(t),operationId=randomUUID(),order=await f.send('/orders',{...f.checkout,operationId});
 await f.send('/orders/'+order.data.id,{action:'prepare'});
 const key='local-recovery-only-secret-123456789',backup=makeBackup(f.store,key),destination=join(f.dir,'restored');
 assert.throws(()=>restoreBackup(backup,destination,key+'wrong'));
 const tampered=Buffer.from(backup);tampered[tampered.length-1]^=1;assert.throws(()=>restoreBackup(tampered,destination,key));
 restoreBackup(backup,destination,key);assert.throws(()=>restoreBackup(backup,destination,key));
 const restored=new Store(destination);try{const db=restored.tenant(restored.bySlug('test-cafe').id);assert.equal(db.prepare('SELECT quantity_milli q FROM stock').get().q,600000);assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(order.data.id).status,'preparing');assert.ok(db.prepare('SELECT response FROM operations WHERE id=?').get(operationId));assert.equal(db.prepare('SELECT COUNT(*) n FROM sessions').get().n,0);}finally{restored.close();}
});
test('counter saves authoritative snapshots and retries never repeat a sale, refund or stock deduction',async t=>{
 const f=await cafe(t),operationId=randomUUID();
 const [first,retry]=await Promise.all([f.send('/orders',{...f.checkout,operationId}),f.send('/orders',{...f.checkout,operationId})]);assert.equal(first.status,201);assert.equal(first.data.id,retry.data.id);assert.equal(first.data.change,6000);
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM orders').get().n,1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payment_events').get().n,1);
 assert.equal((await f.send('/orders',{...f.checkout,cashTendered:50000,operationId})).status,409);
 const updated={...f.product,options:{...f.product.options,sizes:[{...f.product.options.sizes[0],recipe:[{ingredientId:f.milk,quantityMilli:1000}]}]}};
 assert.equal((await f.send('/products/'+f.productId,updated,'PATCH')).status,200);
 const prepare={action:'prepare',operationId:randomUUID()};assert.equal((await f.send('/orders/'+first.data.id,prepare)).status,200);assert.equal((await f.send('/orders/'+first.data.id,prepare)).status,200);
 assert.equal(f.db.prepare('SELECT quantity_milli q FROM stock').get().q,600000);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE kind='recipe'").get().n,1);
 assert.equal((await f.send('/orders/'+first.data.id,{action:'prepare'})).status,409);
 assert.equal((await f.send('/orders/'+first.data.id,{action:'ready'})).status,200);assert.equal((await f.send('/orders/'+first.data.id,{action:'complete'})).status,200);
 const refund={action:'refund',reason:'Returned to customer',verified:true,operationId:randomUUID()};assert.equal((await f.send('/orders/'+first.data.id,refund)).status,200);assert.equal((await f.send('/orders/'+first.data.id,refund)).status,200);
 assert.equal(f.db.prepare('SELECT quantity_milli q FROM stock').get().q,600000);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM payment_events WHERE kind='refund'").get().n,1);
 const state=(await f.request(f.prefix+'/data?branch='+f.branchId,f.owner)).data;assert.equal(state.summary.paid,34000);assert.equal(state.summary.refunds,34000);assert.equal(state.summary.netSales,0);assert.equal(state.orders[0].status,'completed');
});
test('electronic payments require independent verification and stock shortage rolls back preparation',async t=>{
 const f=await cafe(t);assert.equal((await f.send('/orders',{...f.checkout,expectedTotal:1})).status,409);
 assert.equal((await f.send('/orders',{...f.checkout,lines:[{...f.checkout.lines[0],addonIds:['invalid']}]})).status,400);
 const r=await f.send('/orders',{...f.checkout,method:'gcash'});assert.equal(r.status,201);assert.equal(r.data.paymentStatus,'pending');assert.equal((await f.send('/orders/'+r.data.id,{action:'prepare'})).status,409);
 assert.equal((await f.send('/orders/'+r.data.id,{action:'confirm',reference:'bank-ref'})).status,400);assert.equal((await f.send('/orders/'+r.data.id,{action:'confirm',reference:'bank-ref',verified:true})).status,200);
 await f.send('/stock',{branchId:f.branchId,ingredientId:f.milk,kind:'count',quantityMilli:1000,reason:'Physical count'});
 assert.equal((await f.send('/orders/'+r.data.id,{action:'prepare'})).status,409);assert.equal(f.db.prepare('SELECT status FROM orders WHERE id=?').get(r.data.id).status,'queued');assert.equal(f.db.prepare("SELECT COUNT(*) n FROM stock_movements WHERE kind='recipe'").get().n,0);
 const unpaid=await f.send('/orders',{...f.checkout,method:'bank'});assert.equal((await f.send('/orders/'+unpaid.data.id,{action:'cancel',reason:'Customer left'})).status,200);assert.equal((await f.send('/orders/'+unpaid.data.id,{action:'confirm',reference:'later',verified:true})).status,409);
});
test('receiving, adjustments, expenses, tasks, optional customers and exports keep an auditable history',async t=>{
 const f=await cafe(t);const receive={branchId:f.branchId,ingredientId:f.milk,kind:'receive',quantityMilli:500000,reason:'Supplier delivery',totalCost:7500,supplier:'Dairy',reference:'INV-1',operationId:randomUUID()};assert.equal((await f.send('/stock',receive)).status,201);await f.send('/stock',receive);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM purchases').get().n,1);
 assert.equal((await f.send('/stock',{...receive,operationId:randomUUID(),kind:'waste',quantityMilli:2000000})).status,409);
 const c=await f.send('/customers',{name:'Sample guest',contact:'',note:'No marketing consent'});assert.equal(c.status,201);
 const order=await f.send('/orders',{...f.checkout,customerId:c.data.id});assert.equal(order.status,201);assert.equal((await f.request(f.prefix+'/customers/'+c.data.id,f.owner)).data.orders.length,1);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const expense=await f.send('/expenses',{branchId:f.branchId,businessDate:day,amount:12300,category:'Transport',method:'cash',note:'=FORMULA()'});assert.equal(expense.status,201);
 const task=await f.send('/tasks',{branchId:f.branchId,title:'Close the café',instructions:'Count milk',assignee:'Owner',dueAt:new Date().toISOString()});assert.equal(task.status,201);assert.equal((await f.send('/tasks/'+task.data.id,{branchId:f.branchId,status:'done'},'PATCH')).status,200);
 const data=(await f.request(f.prefix+'/data?branch='+f.branchId,f.owner)).data;assert.equal(data.summary.purchases,7500);assert.equal(data.summary.expenses,12300);assert.equal(data.tasks[0].status,'done');
 const csv=await f.request(f.prefix+'/export?branch='+f.branchId+'&type=expenses',f.owner);assert.equal(csv.status,200);assert.match(csv.data,/'=FORMULA/);assert.match(csv.data,/12300/);
 assert.equal((await f.send('/expenses/'+expense.data.id,{branchId:f.branchId,reason:'Duplicate paper entry'},'PATCH')).status,200);assert.equal((await f.request(f.prefix+'/data?branch='+f.branchId,f.owner)).data.summary.expenses,0);
 assert.equal((await f.request(f.prefix+'/data?branch='+f.branchId+'&from=2026-02-30',f.owner)).status,400);
});
test('private copies rotate, branch boundaries apply, and monitoring returns only aggregate business data',async t=>{
 const f=await cafe(t);assert.equal((await f.send('/orders',{...f.checkout,branchId:randomUUID()})).status,403);
 assert.equal((await f.request(f.prefix+'/data?branch='+randomUUID(),f.owner)).status,403);
 const order=await f.send('/orders',f.checkout);const copy=await f.send('/orders/'+order.data.id,{action:'copy'});assert.equal(copy.status,200);
 const page=await f.request('/test-cafe/_receipt/'+copy.data.copyToken);assert.equal(page.status,200);assert.match(page.data,/not a tax invoice/);assert.match(page.data,/Large/);assert.doesNotMatch(page.data,/receipt_hash|password_hash/);assert.equal(page.headers.get('x-robots-tag'),'noindex, nofollow');
 const copy2=await f.send('/orders/'+order.data.id,{action:'copy'});assert.equal((await f.request('/test-cafe/_receipt/'+copy.data.copyToken)).status,404);assert.equal((await f.request('/test-cafe/_receipt/'+copy2.data.copyToken)).status,200);
 assert.equal((await f.request('/api/integrations/monitor')).status,401);const monitor=await f.request('/api/integrations/monitor',{bearer:'local-monitor-token-only'});assert.equal(monitor.status,200);assert.equal(monitor.data.tenants[0].orders,1);assert.deepEqual(Object.keys(monitor.data.tenants[0]).sort(),['locations','name','orders','plan','products','slug','status']);assert.doesNotMatch(JSON.stringify(monitor.data),/password|receipt_hash|token/i);
 for(const asset of ['/assets/pos.mjs','/assets/pos.css','/assets/coming-soon.mjs'])assert.equal((await f.request(asset)).status,200);
});
test('owner recovery revokes sessions and preserves café records',async t=>{
 const f=await cafe(t);const reset=await f.request('/api/console/tenants/test-cafe/reset',f.operator,{password:'replacement-local-password-456'});assert.equal(reset.status,200);
 assert.equal((await f.request(f.prefix+'/workspace',f.owner)).status,401);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM products').get().n,1);
 const login=await f.request(f.prefix+'/login',{}, {username:'owner',password:'replacement-local-password-456'});assert.equal(login.status,200);
});
test('server report dates keep a later refund separate from the original sale',async t=>{
 const f=await cafe(t),sale=await f.send('/orders',f.checkout);f.db.prepare("UPDATE payment_events SET at='2026-11-01T15:59:00.000Z' WHERE order_id=?").run(sale.data.id);
 const refund=await f.send('/orders/'+sale.data.id,{action:'refund',reason:'Returned',verified:true});assert.equal(refund.status,200);f.db.prepare("UPDATE payment_events SET at='2026-11-01T16:01:00.000Z' WHERE kind='refund'").run();
 const day1=(await f.request(f.prefix+'/data?branch='+f.branchId+'&from=2026-11-01&to=2026-11-01',f.owner)).data;const day2=(await f.request(f.prefix+'/data?branch='+f.branchId+'&from=2026-11-02&to=2026-11-02',f.owner)).data;
 assert.equal(day1.summary.paid,34000);assert.equal(day1.summary.refunds,0);assert.equal(day2.summary.paid,0);assert.equal(day2.summary.refunds,34000);
});
