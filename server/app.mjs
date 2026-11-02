import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Store, fail, field, transaction } from './store.mjs';
import { readSession, newSession, verifyPassword, allowLogin, cookie } from './auth.mjs';
import { landing, workspace, storefront, notFound } from './views.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const assets = {
  '/assets/site.css': ['web/site.css','text/css'],
  '/assets/workspace.mjs': ['web/workspace.mjs','text/javascript'],
  '/assets/coming-soon.mjs': ['web/coming-soon.mjs','text/javascript'],
  '/assets/mark.svg': ['web/mark.svg','image/svg+xml'],
  '/assets/counter-preview.jpg': ['docs/assets/counter-preview-desktop.jpg','image/jpeg'],
  '/_demo/': ['prototype/index.html','text/html'],
  '/_demo/styles.css': ['prototype/styles.css','text/css'],
  '/_demo/app.mjs': ['prototype/app.mjs','text/javascript'],
  '/_demo/domain.mjs': ['prototype/domain.mjs','text/javascript']
};
function json(res, status, value) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); }
function html(req, res, status, value) { res.writeHead(status, {'Content-Type':'text/html; charset=utf-8'}); res.end(req.method === 'HEAD' ? undefined : value); }
async function body(req) {
  if (!(req.headers['content-type'] || '').startsWith('application/json')) fail(415, 'Send JSON.');
  let bytes = 0, chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if(bytes > 16384) fail(413, 'Request is too large.'); chunks.push(chunk); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error(); return data; } catch { fail(400, 'Check the request fields.'); }
}
function headers(res, production) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'");
  if(production) res.setHeader('Strict-Transport-Security','max-age=31536000');
}
function originAllowed(req, config) {
  const origin = req.headers.origin;
  if (!origin) return false;
  if (config.origins.includes(origin)) return true;
  return !config.production && origin === `http://${req.headers.host}`;
}
function csrf(req, session) {
  if (!session) fail(401, 'Sign in to continue.');
  if (req.headers['x-csrf-token'] !== session.csrf) fail(403, 'Refresh the page before continuing.');
}
function tenantAudit(db, actor, action, detail = {}) {
  db.prepare('INSERT INTO audit(actor,action,detail,at) VALUES(?,?,?,?)').run(actor,action,JSON.stringify(detail),new Date().toISOString());
}

export async function createApp(config) {
  if (config.production && (!config.dataDir || !config.origins?.length || !config.consolePassword)) throw new Error('Production needs DATA_DIR, PUBLIC_ORIGIN and console credentials.');
  const store = new Store(config.dataDir || './data');
  try { await store.bootstrap(config.consoleUsername, config.consolePassword); } catch(error) { store.close(); throw error; }
  const activeHashes = new Set();
  async function login(req, res, db, cookieName, realm, input, stillActive = () => true) {
    if (typeof input.username !== 'string' || input.username.length > 40 || typeof input.password !== 'string' || Buffer.byteLength(input.password) > 256) fail(400, 'Check your sign-in details.');
    const username = input.username.toLowerCase().trim();
    // Account buckets and a shared unknown-account bucket do not trust proxy IP headers.
    const account = db.prepare('SELECT * FROM users WHERE username=?').get(username);
    const attemptKey = account ? `user:${username}` : 'unknown-account';
    if (activeHashes.size >= 4 || !allowLogin(db, attemptKey)) fail(429,'Too many sign-in attempts. Wait 10 minutes and try again.');
    const marker = randomUUID(); activeHashes.add(marker);
    let valid, user;
    try { user = account; valid = await verifyPassword(input.password,user?.password_hash); } finally { activeHashes.delete(marker); }
    if (!valid || !user) fail(401,'Username or password is incorrect.');
    if (!stillActive()) fail(404,'Café workspace is unavailable.');
    const session = newSession(db,user,config.production,cookieName);
    db.prepare('DELETE FROM auth_attempts WHERE key=?').run(attemptKey);
    res.setHeader('Set-Cookie',session.cookie);
    if(realm==='console') store.audit(user.id,'operator.login',null);
    else tenantAudit(db,user.id,'user.login');
    json(res,200,{username:user.username,role:user.role,csrf:session.csrf});
  }
  const server = http.createServer(async (req,res) => {
    headers(res,config.production);
    try {
      const url = new URL(req.url,'http://relax.local');
      const path = url.pathname;
      if (!['GET','HEAD','POST','PATCH'].includes(req.method)) { res.setHeader('Allow','GET, HEAD, POST, PATCH'); fail(405,'Method not allowed.'); }
      const write = ['POST','PATCH'].includes(req.method);
      if(write && !originAllowed(req,config)) fail(403,'Request origin is not allowed.');
      const input = write ? await body(req) : null;
      if(path==='/api/health' && req.method==='GET') {
        store.platform.prepare('SELECT 1').get(); return json(res,200,{ok:true,service:'relax',version:'0.2.0'});
      }
      if(path.startsWith('/api/console/')) {
        const db=store.platform, name='relax_console', session=readSession(db,req,name), action=path.slice('/api/console/'.length);
        if(action==='login' && req.method==='POST') return await login(req,res,db,name,'console',input);
        if(!session || session.role!=='operator') fail(401,'Sign in to the operator console.');
        if(write) csrf(req,session);
        if(action==='session' && req.method==='GET') return json(res,200,{username:session.username,role:session.role,csrf:session.csrf});
        if(action==='logout' && req.method==='POST') { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash); res.setHeader('Set-Cookie',cookie(name,'',config.production)); return json(res,200,{ok:true}); }
        if(action==='tenants' && req.method==='GET') {
          const tenants=store.listTenants().map(t=>{
            if(!['active','suspended'].includes(t.status)) return {...t,products:0,branches:0,accounts:0};
            const tenantDb=store.tenant(t.id);
            return {...t,products:tenantDb.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get().n,branches:tenantDb.prepare('SELECT COUNT(*) n FROM branches').get().n,accounts:tenantDb.prepare('SELECT COUNT(*) n FROM users').get().n};
          });
          return json(res,200,{tenants,audit:db.prepare('SELECT action,tenant_id,at FROM audit ORDER BY id DESC LIMIT 12').all()});
        }
        if(action==='tenants' && req.method==='POST') return json(res,201,{tenant:await store.createTenant(input,session.id)});
        const update=/^tenants\/([a-z0-9-]+)$/.exec(action);
        if(update && req.method==='PATCH') return json(res,200,{tenant:store.updateTenant(update[1],input,session.id)});
        fail(404,'Endpoint not found.');
      }
      const tenantRoute=/^\/api\/cafes\/([a-z0-9-]+)\/([a-z]+)(?:\/([a-zA-Z0-9-]+))?$/.exec(path);
      if(tenantRoute) {
        const [,slug,action,recordId]=tenantRoute, tenant=store.bySlug(slug);
        if(!tenant || tenant.status!=='active') fail(404,'Café workspace is unavailable.');
        const db=store.tenant(tenant.id), name=`relax_t_${tenant.id.replaceAll('-','')}`, session=readSession(db,req,name);
        if(action==='login' && req.method==='POST') return await login(req,res,db,name,'tenant',input,()=>store.bySlug(slug)?.status==='active');
        if(!session) fail(401,'Sign in to this café.');
        if(write) csrf(req,session);
        if(action==='session' && req.method==='GET') return json(res,200,{username:session.username,role:session.role,csrf:session.csrf});
        if(action==='logout' && req.method==='POST') { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(session.token_hash);res.setHeader('Set-Cookie',cookie(name,'',config.production));return json(res,200,{ok:true}); }
        if(session.role!=='owner') fail(403,'This workspace setup is limited to the café owner.');
        if(action==='workspace' && req.method==='GET') return json(res,200,{tenant,profile:db.prepare('SELECT description,address,hours FROM profile WHERE id=1').get(),products:db.prepare('SELECT * FROM products ORDER BY created_at DESC').all(),branches:db.prepare('SELECT b.* FROM branches b JOIN memberships m ON m.branch_id=b.id WHERE m.user_id=?').all(session.id)});
        if(action==='profile' && req.method==='PATCH') {
          const data=input, description=field(data.description,'description',500),address=field(data.address,'address',300),hours=field(data.hours,'opening hours',200);
          transaction(db,()=>{db.prepare('UPDATE profile SET description=?,address=?,hours=? WHERE id=1').run(description,address,hours);tenantAudit(db,session.id,'profile.updated');});
          return json(res,200,{ok:true});
        }
        if(action==='products' && req.method==='POST') {
          const data=input, name=field(data.name,'product name',100,true),category=field(data.category,'category',40,true),description=field(data.description,'description',300);
          if(!Number.isInteger(data.price) || data.price<0 || data.price>100000000) fail(400,'Enter a valid price in centavos.');
          const id=randomUUID();
          transaction(db,()=>{
            if(db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get().n>=tenant.product_limit) fail(409,`This café has reached its ${tenant.product_limit} active-item allowance.`);
            db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?)').run(id,name,category,description,data.price,1,new Date().toISOString());
            tenantAudit(db,session.id,'product.created',{id});
          }); return json(res,201,{id});
        }
        if(action==='products' && recordId && req.method==='PATCH') {
          const data=input;if(typeof data.active!=='boolean')fail(400,'Check the product status.');
          transaction(db,()=>{
            const p=db.prepare('SELECT active FROM products WHERE id=?').get(recordId);if(!p)fail(404,'Product not found.');
            if(data.active&&!p.active&&db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get().n>=tenant.product_limit)fail(409,'Active menu allowance reached.');
            db.prepare('UPDATE products SET active=? WHERE id=?').run(data.active?1:0,recordId);tenantAudit(db,session.id,'product.status',{id:recordId,active:data.active});
          });return json(res,200,{ok:true});
        }
        if(action==='branches' && req.method==='POST') {
          const data=input,name=field(data.name,'location name',100,true),id=randomUUID();
          transaction(db,()=>{
            if(db.prepare('SELECT COUNT(*) n FROM branches').get().n>=tenant.location_limit)fail(409,'Your location allowance is already in use.');
            db.prepare('INSERT INTO branches VALUES(?,?,?)').run(id,name,new Date().toISOString());db.prepare('INSERT INTO memberships VALUES(?,?)').run(session.id,id);tenantAudit(db,session.id,'branch.created',{id});
          });return json(res,201,{id});
        }
        fail(404,'Endpoint not found.');
      }
      if(write) fail(404,'Endpoint not found.');
      if(!config.production && path==='/_qa/') {
        res.setHeader('Content-Security-Policy',"default-src 'none'; frame-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'");
        try { return html(req,res,200,await readFile(root+'.qa/mobile.html','utf8')); }
        catch { return html(req,res,404,notFound()); }
      }
      if(path==='/')return html(req,res,200,landing());
      if(path==='/_console' || path==='/_console/')return html(req,res,200,workspace('Operator console'));
      if(path==='/_demo'){res.writeHead(308,{Location:'/_demo/'});return res.end();}
      if(path==='/robots.txt'){res.writeHead(200,{'Content-Type':'text/plain'});return res.end('User-agent: *\nDisallow: /_console\nDisallow: /api/\nDisallow: /*/_app\nDisallow: /_demo/\n');}
      if(assets[path]){
        const [file,type]=assets[path],content=await readFile(root+file);
        res.writeHead(200,{'Content-Type':`${type}${type.startsWith('text/')?'; charset=utf-8':''}`});return res.end(req.method==='HEAD'?undefined:content);
      }
      const cafe=/^\/([a-z0-9-]+)(\/|\/_app\/?)?$/.exec(path);
      if(cafe){
        const tenant=store.bySlug(cafe[1]);
        if(tenant?.status==='active'){
          if(cafe[2]?.startsWith('/_app'))return html(req,res,200,workspace(`${tenant.name} · Café workspace`));
          if(tenant.plan==='paid' && tenant.website_enabled){const db=store.tenant(tenant.id);return html(req,res,200,storefront(tenant,db.prepare('SELECT * FROM profile WHERE id=1').get(),db.prepare('SELECT name,category,description,price FROM products WHERE active=1 ORDER BY category,name').all()));}
        }
      }
      html(req,res,404,notFound());
    }catch(error){
      const status=error.status || 500;
      if(status>=500)console.error('Request failed:',error.message);
      if(!res.headersSent)json(res,status,{error:status>=500?'Something went wrong. Please try again.':error.message});else res.end();
    }
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=50;
  return {server,store};
}
