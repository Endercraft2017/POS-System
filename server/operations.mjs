import { randomUUID, createHash } from 'node:crypto';
import { fail, field, transaction } from './store.mjs';
import { digest, token } from './auth.mjs';

const now = () => new Date().toISOString();
const methods = ['cash','gcash','maya','bank','card'];
export const businessDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit' }).format(value);
function integer(value, name, min = 0, max = 100000000) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, `Check ${name}.`); return value; }
function list(value, name, max) { if (!Array.isArray(value) || value.length > max) fail(400, `Check ${name}.`); return value; }
function method(value) { if (!methods.includes(value)) fail(400,'Choose a supported payment method.'); return value; }
export function audit(db, actor, action, detail = {}) { db.prepare('INSERT INTO audit(actor,action,detail,at) VALUES(?,?,?,?)').run(actor,action,JSON.stringify(detail),now()); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])); return value; }
export function once(db, actor, kind, input, fn) {
  if (typeof input.operationId !== 'string' || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.operationId)) fail(400,'A valid operation ID is required.');
  const fingerprint=createHash('sha256').update(JSON.stringify(canonical(input))).digest('hex');
  return transaction(db,()=>{
    const old=db.prepare('SELECT * FROM operations WHERE id=?').get(input.operationId);
    if(old) { if(old.actor!==actor || old.kind!==kind || old.fingerprint!==fingerprint) fail(409,'This save ID belongs to a different request. Resolve the original save first.'); return JSON.parse(old.response); }
    const result=fn();
    db.prepare('INSERT INTO operations VALUES(?,?,?,?,?,?)').run(input.operationId,actor,kind,fingerprint,JSON.stringify(result),now());
    audit(db,actor,kind,{operationId:input.operationId,id:result.id||null}); return result;
  });
}
export function branchAccess(db, user, id) { if(typeof id!=='string' || !db.prepare('SELECT 1 FROM memberships WHERE user_id=? AND branch_id=?').get(user,id)) fail(403,'Select a location assigned to your account.'); return id; }
function recipe(db, value) {
  const seen=new Set();return list(value??[],'recipe',50).map(r=>{
    if(!r || typeof r.ingredientId!=='string' || seen.has(r.ingredientId) || !db.prepare('SELECT id FROM ingredients WHERE id=?').get(r.ingredientId)) fail(400,'Use each valid ingredient once in a recipe.');
    seen.add(r.ingredientId);return{ingredientId:r.ingredientId,quantityMilli:integer(r.quantityMilli,'recipe quantity',1,1000000000)};
  });
}
export function productInput(db, data) {
  const options=data.options??{sizes:[],addons:[],modifiers:[],trackStock:false};
  if(typeof options.trackStock!=='boolean') fail(400,'Choose whether this product tracks ingredients.');
  const ids=new Set();const option=(o,priceRequired=true)=>{if(!o||typeof o!=='object'||Array.isArray(o))fail(400,'Check the product options.');const id=field(o.id,'option ID',40,true);if(!/^[a-zA-Z0-9_-]+$/.test(id)||ids.has(id))fail(400,'Product option IDs must be unique.');ids.add(id);return{id,label:field(o.label,'option label',60,true),...(priceRequired?{price:integer(o.price,'option price'),recipe:recipe(db,o.recipe)}:{})};};
  const sizes=list(options.sizes??[],'sizes',8).map(o=>option(o));
  const addons=list(options.addons??[],'add-ons',12).map(o=>option(o));
  const modifiers=list(options.modifiers??[],'modifiers',4).map(o=>({...option(o,false),choices:list(o.choices,'modifier choices',10).map(v=>field(v,'modifier choice',40,true))}));
  if(modifiers.some(m=>!m.choices.length || new Set(m.choices).size!==m.choices.length))fail(400,'Give each modifier unique choices.');
  const base=recipe(db,data.recipe);
  if(options.trackStock && !base.length && (!sizes.length || sizes.some(s=>!s.recipe.length))) fail(400,'Add a recipe for each tracked product size.');
  return{name:field(data.name,'product name',100,true),category:field(data.category,'category',40,true),description:field(data.description??'','description',300),price:integer(data.price,'product price'),options:{sizes,addons,modifiers,trackStock:options.trackStock},recipe:base};
}
export function products(db) { return db.prepare('SELECT * FROM products ORDER BY category,name').all().map(({options_json,recipe_json,...p})=>({...p,options:JSON.parse(options_json),recipe:JSON.parse(recipe_json)})); }
export function saveProduct(db, actor, tenant, data, id) {
  return once(db,actor,id?'product.updated':'product.created',data,()=>{
    const p=productInput(db,data),at=now();
    if(id && !db.prepare('SELECT id FROM products WHERE id=?').get(id))fail(404,'Product not found.');
    if(!id && db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get().n>=tenant.product_limit)fail(409,`Your ${tenant.product_limit} active-product allowance is in use.`);
    const key=id||randomUUID();
    if(id)db.prepare('UPDATE products SET name=?,category=?,description=?,price=?,options_json=?,recipe_json=? WHERE id=?').run(p.name,p.category,p.description,p.price,JSON.stringify(p.options),JSON.stringify(p.recipe),id);
    else db.prepare('INSERT INTO products(id,name,category,description,price,active,created_at,options_json,recipe_json) VALUES(?,?,?,?,?,1,?,?,?)').run(key,p.name,p.category,p.description,p.price,at,JSON.stringify(p.options),JSON.stringify(p.recipe));
    return{id:key};
  });
}
export function saveIngredient(db,actor,data,id) {
  return once(db,actor,id?'ingredient.updated':'ingredient.created',data,()=>{
    const name=field(data.name,'ingredient name',100,true),low=integer(data.lowMilli,'low stock threshold',0,1000000000),cost=integer(data.unitCost??0,'unit cost');
    if(!['g','mL','pc'].includes(data.unit))fail(400,'Choose g, mL or pc as the base unit.');
    const key=id||randomUUID();
    if(id){const old=db.prepare('SELECT * FROM ingredients WHERE id=?').get(id);if(!old)fail(404,'Ingredient not found.');if(old.unit!==data.unit)fail(409,'Base units cannot change after creation.');db.prepare('UPDATE ingredients SET name=?,low_milli=?,unit_cost=? WHERE id=?').run(name,low,cost,id);}
    else db.prepare('INSERT INTO ingredients VALUES(?,?,?,?,?,?)').run(key,name,data.unit,low,cost,now());
    return{id:key};
  });
}
function moveStock(db,{branchId,ingredientId,delta,kind,reason,sourceId,actor,at}) {
  const current=db.prepare('SELECT quantity_milli q FROM stock WHERE branch_id=? AND ingredient_id=?').get(branchId,ingredientId)?.q??0;
  const next=current+delta;if(!Number.isSafeInteger(next)||next<0||next>1000000000000)fail(409,'Stock movement would create an invalid or negative balance.');
  db.prepare('INSERT INTO stock VALUES(?,?,?) ON CONFLICT(branch_id,ingredient_id) DO UPDATE SET quantity_milli=excluded.quantity_milli').run(branchId,ingredientId,next);
  db.prepare('INSERT INTO stock_movements VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),branchId,ingredientId,delta,kind,reason,sourceId,actor,at);
}
export function stockChange(db,actor,data) {
  branchAccess(db,actor,data.branchId);
  return once(db,actor,'stock.recorded',data,()=>{
    if(!db.prepare('SELECT id FROM ingredients WHERE id=?').get(data.ingredientId))fail(404,'Ingredient not found.');
    if(!['receive','opening','waste','count'].includes(data.kind))fail(400,'Choose a stock movement.');
    const qty=integer(data.quantityMilli,'stock quantity',data.kind==='count'?0:1,1000000000000),reason=field(data.reason??'','reason',300,true),id=randomUUID(),at=now();
    const old=db.prepare('SELECT quantity_milli q FROM stock WHERE branch_id=? AND ingredient_id=?').get(data.branchId,data.ingredientId)?.q??0;
    if(data.kind==='opening' && db.prepare('SELECT 1 FROM stock_movements WHERE branch_id=? AND ingredient_id=?').get(data.branchId,data.ingredientId))fail(409,'Opening stock already exists. Use a count correction.');
    const delta=data.kind==='count'?qty-old:data.kind==='waste'?-qty:qty;
    moveStock(db,{branchId:data.branchId,ingredientId:data.ingredientId,delta,kind:data.kind,reason,sourceId:id,actor,at});
    if(data.kind==='receive')db.prepare('INSERT INTO purchases VALUES(?,?,?,?,?,?,?,?,?)').run(id,data.branchId,data.ingredientId,qty,integer(data.totalCost,'purchase total cost'),field(data.supplier??'','supplier',150),field(data.reference??'','reference',100),actor,at);
    return{id};
  });
}
export function checkout(db,actor,data) {
  branchAccess(db,actor,data.branchId);
  return once(db,actor,'order.created',data,()=>{
    const all=products(db),lines=list(data.lines,'order lines',40);if(!lines.length)fail(400,'Add an item to the order.');
    const snapshot=lines.map(line=>{
      if(!line||typeof line!=='object'||Array.isArray(line))fail(400,'Check the order line.');
      const p=all.find(p=>p.id===line.productId&&p.active);if(!p)fail(409,'A product is no longer available. Refresh the menu.');
      const qty=integer(line.quantity,'item quantity',1,100),o=p.options;
      const size=o.sizes.find(s=>s.id===line.sizeId);if(o.sizes.length&&!size)fail(400,'Choose a valid size.');if(!o.sizes.length&&line.sizeId)fail(400,'This product has no sizes.');
      const addonIds=list(line.addonIds??[],'selected add-ons',12);if(new Set(addonIds).size!==addonIds.length)fail(400,'Select each add-on once.');
      const addons=addonIds.map(id=>{const a=o.addons.find(a=>a.id===id);if(!a)fail(400,'Choose valid add-ons.');return a;});
      const selections=line.modifiers??{};if(!selections||typeof selections!=='object'||Array.isArray(selections)||Object.keys(selections).some(k=>!o.modifiers.some(m=>m.id===k)))fail(400,'Choose valid modifiers.');
      const modifiers=o.modifiers.map(m=>{const value=selections[m.id];if(!m.choices.includes(value))fail(400,`Choose ${m.label}.`);return{label:m.label,value};});
      const unitPrice=(size?size.price:p.price)+addons.reduce((n,a)=>n+a.price,0);integer(unitPrice,'item total');
      const ingredients=o.trackStock?[...(size?.recipe.length?size.recipe:p.recipe),...addons.flatMap(a=>a.recipe)].map(r=>{const i=db.prepare('SELECT name,unit FROM ingredients WHERE id=?').get(r.ingredientId);if(!i)fail(409,'Recipe ingredient is unavailable.');return{...r,...i};}):[];
      return{productId:p.id,name:p.name,size:size?.label??'',addons:addons.map(a=>({label:a.label,price:a.price})),modifiers,quantity:qty,unitPrice,lineTotal:unitPrice*qty,recipe:ingredients,tracked:o.trackStock,note:field(line.note??'','preparation note',200)};
    });
    const total=snapshot.reduce((n,l)=>n+l.lineTotal,0);integer(total,'order total');if(data.expectedTotal!==total)fail(409,'The menu price changed. Review the refreshed order total.');
    const paymentMethod=method(data.method),cash=paymentMethod==='cash'?integer(data.cashTendered,'cash received',total):0;
    let customer=null;if(data.customerId){customer=db.prepare('SELECT id,name FROM customers WHERE id=?').get(data.customerId);if(!customer)fail(404,'Customer not found.');}
    const id=randomUUID(),at=now(),number=db.prepare('SELECT COALESCE(MAX(number),0)+1 n FROM orders').get().n;
    db.prepare('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,number,data.branchId,actor,customer?.id??null,customer?.name??'',JSON.stringify(snapshot),total,paymentMethod,cash,paymentMethod==='cash'?'paid':'pending','queued',field(data.note??'','order note',300),null,at,at);
    if(paymentMethod==='cash')db.prepare('INSERT INTO payment_events VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,data.branchId,'payment',total,'cash','','',actor,at);
    return{id,number,total,change:cash-total,paymentStatus:paymentMethod==='cash'?'paid':'pending'};
  });
}
export function orderAction(db,actor,id,data) {
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(id);if(!order)fail(404,'Order not found.');branchAccess(db,actor,order.branch_id);
  return once(db,actor,`order.${data.action}`,{...data,orderId:id},()=>{
    const at=now();
    if(data.action==='confirm'){
      if(order.payment_status!=='pending'||order.status!=='queued')fail(409,'Only a pending queued order can be confirmed.');
      if(data.verified!==true)fail(400,'Independently verify the payment first.');
      const reference=field(data.reference,'payment reference',100,true);
      db.prepare("UPDATE orders SET payment_status='paid',updated_at=? WHERE id=?").run(at,id);
      db.prepare('INSERT INTO payment_events VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,order.branch_id,'payment',order.total,order.method,reference,'Staff verified in the receiving payment account',actor,at);
    }else if(data.action==='prepare'){
      if(order.status!=='queued'||order.payment_status!=='paid')fail(409,'Preparation requires a paid queued order.');
      const usage=new Map();for(const line of JSON.parse(order.snapshot))for(const r of line.recipe)usage.set(r.ingredientId,(usage.get(r.ingredientId)??0)+r.quantityMilli*line.quantity);
      for(const [ingredientId,quantity] of usage){const have=db.prepare('SELECT quantity_milli q FROM stock WHERE branch_id=? AND ingredient_id=?').get(order.branch_id,ingredientId)?.q??0;if(have<quantity){const ingredient=db.prepare('SELECT name FROM ingredients WHERE id=?').get(ingredientId);fail(409,`Not enough ${ingredient.name}. Receive or correct stock before preparation.`);}}
      for(const [ingredientId,quantity] of usage)moveStock(db,{branchId:order.branch_id,ingredientId,delta:-quantity,kind:'recipe',reason:`Order #${order.number}`,sourceId:id,actor,at});
      db.prepare("UPDATE orders SET status='preparing',updated_at=? WHERE id=?").run(at,id);
    }else if(data.action==='ready'||data.action==='complete'){
      const prior=data.action==='ready'?'preparing':'ready',next=data.action==='ready'?'ready':'completed';if(order.status!==prior||order.payment_status!=='paid')fail(409,'The order is not ready for that step.');db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(next,at,id);
    }else if(data.action==='cancel'){
      if(order.payment_status!=='pending'||order.status!=='queued')fail(409,'Only unpaid, unprepared orders can be cancelled. Use a refund for paid orders.');const reason=field(data.reason,'cancellation reason',300,true);db.prepare("UPDATE orders SET status='cancelled',updated_at=? WHERE id=?").run(at,id);audit(db,actor,'order.cancel_reason',{id,reason});
    }else if(data.action==='refund'){
      if(order.payment_status!=='paid')fail(409,'Only a paid order can be refunded.');if(data.verified!==true)fail(400,'Confirm the refund was returned through the original payment method.');
      const reason=field(data.reason,'refund reason',300,true),reference=field(data.reference??'','refund reference',100,order.method!=='cash');
      db.prepare("UPDATE orders SET payment_status='refunded',status=?,updated_at=? WHERE id=?").run(order.status==='completed'?'completed':'cancelled',at,id);
      db.prepare('INSERT INTO payment_events VALUES(?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),id,order.branch_id,'refund',order.total,order.method,reference,reason,actor,at);
    }else if(data.action==='copy'){
      const raw=token();db.prepare('UPDATE orders SET receipt_hash=? WHERE id=?').run(digest(raw),id);return{id,copyToken:raw};
    }else fail(400,'Unknown order action.');
    return{id};
  });
}
export function customerSave(db,actor,data,id) { return once(db,actor,id?'customer.updated':'customer.created',data,()=>{const name=field(data.name,'customer name',100,true),contact=field(data.contact??'','contact',150),note=field(data.note??'','customer note',300),key=id||randomUUID();if(id){if(!db.prepare('SELECT id FROM customers WHERE id=?').get(id))fail(404,'Customer not found.');db.prepare('UPDATE customers SET name=?,contact=?,note=? WHERE id=?').run(name,contact,note,id);}else db.prepare('INSERT INTO customers VALUES(?,?,?,?,?)').run(key,name,contact,note,now());return{id:key};}); }
export function expenseSave(db,actor,data,id) {branchAccess(db,actor,data.branchId);return once(db,actor,id?'expense.voided':'expense.created',data,()=>{
  const key=id||randomUUID();if(id){const old=db.prepare('SELECT * FROM expenses WHERE id=? AND branch_id=?').get(id,data.branchId);if(!old)fail(404,'Expense not found.');if(old.void_reason)fail(409,'This expense is already voided.');db.prepare('UPDATE expenses SET void_reason=? WHERE id=?').run(field(data.reason,'void reason',300,true),id);}
  else {dateRange(data.businessDate,data.businessDate);db.prepare('INSERT INTO expenses VALUES(?,?,?,?,?,?,?,?,?,?)').run(key,data.branchId,integer(data.amount,'expense amount',1),field(data.category,'category',60,true),method(data.method),field(data.note??'','expense note',300),data.businessDate,null,actor,now());}
  return{id:key};});}
export function taskSave(db,actor,data,id) {branchAccess(db,actor,data.branchId);return once(db,actor,id?'task.updated':'task.created',data,()=>{
  const key=id||randomUUID();if(id){const old=db.prepare('SELECT * FROM tasks WHERE id=? AND branch_id=?').get(id,data.branchId);if(!old)fail(404,'Task not found.');if(!['open','done'].includes(data.status))fail(400,'Choose open or done.');db.prepare('UPDATE tasks SET status=?,completed_at=? WHERE id=?').run(data.status,data.status==='done'?now():null,id);}
  else {let due=null;if(data.dueAt){if(typeof data.dueAt!=='string'||!Number.isFinite(Date.parse(data.dueAt)))fail(400,'Check the due date.');due=new Date(data.dueAt).toISOString();}db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?,?,?,NULL,?,?)').run(key,data.branchId,field(data.title,'task title',150,true),field(data.instructions??'','instructions',1000),field(data.assignee??'','assignee',100),due,'open',actor,now());}
  return{id:key};});}
export function dateRange(from=businessDate(),to=from) {
  for(const d of [from,to])if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)fail(400,'Choose valid report dates.');
  const start=new Date(`${from}T00:00:00+08:00`),last=new Date(`${to}T00:00:00+08:00`);if(last<start||last-start>366*86400000)fail(400,'Choose a range of up to 367 days.');return{from,to,start:start.toISOString(),end:new Date(last.getTime()+86400000).toISOString()};
}
export function records(db,actor,branchId,from,to) {
  branchAccess(db,actor,branchId);const range=dateRange(from,to);
  const orderRows=db.prepare('SELECT * FROM orders WHERE branch_id=? AND created_at>=? AND created_at<? ORDER BY number DESC').all(branchId,range.start,range.end);
  const events=db.prepare('SELECT p.*,o.number FROM payment_events p JOIN orders o ON o.id=p.order_id WHERE p.branch_id=? AND p.at>=? AND p.at<? ORDER BY p.at DESC').all(branchId,range.start,range.end);
  const expenses=db.prepare('SELECT * FROM expenses WHERE branch_id=? AND business_date>=? AND business_date<=? ORDER BY business_date DESC,at DESC').all(branchId,range.from,range.to);
  const purchases=db.prepare('SELECT p.*,i.name,i.unit FROM purchases p JOIN ingredients i ON i.id=p.ingredient_id WHERE p.branch_id=? AND p.at>=? AND p.at<? ORDER BY p.at DESC').all(branchId,range.start,range.end);
  const movements=db.prepare('SELECT m.*,i.name,i.unit FROM stock_movements m JOIN ingredients i ON i.id=m.ingredient_id WHERE m.branch_id=? AND m.at>=? AND m.at<? ORDER BY m.at DESC').all(branchId,range.start,range.end);
  const paid=events.filter(e=>e.kind==='payment').reduce((n,e)=>n+e.amount,0),refunds=events.filter(e=>e.kind==='refund').reduce((n,e)=>n+e.amount,0);
  return{range,orders:orderRows.map(({snapshot,receipt_hash,...o})=>({...o,lines:JSON.parse(snapshot)})),events,expenses,purchases,movements,summary:{paid,refunds,netSales:paid-refunds,expenses:expenses.filter(e=>!e.void_reason).reduce((n,e)=>n+e.amount,0),purchases:purchases.reduce((n,p)=>n+p.total_cost,0),methods:methods.map(method=>({method,paid:events.filter(e=>e.kind==='payment'&&e.method===method).reduce((n,e)=>n+e.amount,0),refunds:events.filter(e=>e.kind==='refund'&&e.method===method).reduce((n,e)=>n+e.amount,0)}))}};
}
export function workspaceData(db,actor,branchId,from,to) {
  branchAccess(db,actor,branchId);
  const inventory=db.prepare('SELECT i.*,COALESCE(s.quantity_milli,0) quantity_milli FROM ingredients i LEFT JOIN stock s ON s.ingredient_id=i.id AND s.branch_id=? ORDER BY i.name').all(branchId);
  const openOrders=db.prepare("SELECT * FROM orders WHERE branch_id=? AND status IN ('queued','preparing','ready') ORDER BY number DESC").all(branchId).map(({snapshot,receipt_hash,...o})=>({...o,lines:JSON.parse(snapshot)}));
  return{openOrders,products:products(db),inventory,customers:db.prepare('SELECT * FROM customers ORDER BY name').all(),tasks:db.prepare('SELECT * FROM tasks WHERE branch_id=? ORDER BY status DESC,due_at IS NULL,due_at,created_at DESC').all(branchId),...records(db,actor,branchId,from,to)};
}
export function exportCsv(data,type) {
  const definitions={orders:['number','created_at','status','payment_status','method','total','customer_name','note'],events:['number','at','kind','amount','method','reference','reason'],expenses:['business_date','amount','category','method','note','void_reason'],purchases:['at','name','unit','quantity_milli','total_cost','supplier','reference'],movements:['at','name','unit','delta_milli','kind','reason']};
  const columns=Object.hasOwn(definitions,type)?definitions[type]:null;if(!columns)fail(400,'Choose orders, events, expenses, purchases or movements.');
  const cell=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
  return '\uFEFF'+[columns.map(cell).join(','),...data[type].map(row=>columns.map(k=>cell(row[k])).join(','))].join('\r\n');
}
