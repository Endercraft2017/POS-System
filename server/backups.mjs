import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {DatabaseSync} from 'node:sqlite';

const MAGIC=Buffer.from('RELAXBK1');
function keyCheck(password){if(typeof password!=='string'||password.length<32)throw Error('Set BACKUP_KEY to a secret of at least 32 characters.');}
function check(file){const db=new DatabaseSync(file);try{if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Backup database validation failed.');}finally{db.close();}}
// Synchronous snapshots keep this single-process server from accepting interleaved writes.
export function makeBackup(store,password){
  keyCheck(password);const temp=mkdtempSync(join(tmpdir(),'relax-backup-'));
  try{
    const sources=[['platform.db',store.platform],...store.listTenants().filter(t=>['active','suspended'].includes(t.status)).map(t=>[`tenants/${t.id}.db`,store.tenant(t.id)])];
    const files=sources.map(([path,db],i)=>{const file=join(temp,`${i}.db`);db.prepare('VACUUM INTO ?').run(file);check(file);return{path,data:readFileSync(file).toString('base64')};});
    const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',scryptSync(password,salt,32),iv);
    const body=gzipSync(Buffer.from(JSON.stringify({version:1,createdAt:new Date().toISOString(),files})));
    const encrypted=Buffer.concat([cipher.update(body),cipher.final()]);
    return Buffer.concat([MAGIC,salt,iv,cipher.getAuthTag(),encrypted]);
  }finally{rmSync(temp,{recursive:true,force:true});}
}
export function restoreBackup(buffer,destination,password){
  keyCheck(password);if(!buffer.subarray(0,8).equals(MAGIC)||buffer.length<53)throw Error('Invalid backup.');
  const decipher=createDecipheriv('aes-256-gcm',scryptSync(password,buffer.subarray(8,24),32),buffer.subarray(24,36));decipher.setAuthTag(buffer.subarray(36,52));
  const payload=JSON.parse(gunzipSync(Buffer.concat([decipher.update(buffer.subarray(52)),decipher.final()]),{maxOutputLength:1024*1024*1024}));
  if(payload.version!==1||!Array.isArray(payload.files)||!payload.files.length||payload.files[0].path!=='platform.db')throw Error('Invalid backup manifest.');
  const names=new Set();for(const file of payload.files){if(typeof file.data!=='string'||! /^(platform\.db|tenants\/[a-f0-9-]{36}\.db)$/.test(file.path)||names.has(file.path))throw Error('Invalid backup file.');names.add(file.path);}
  const target=resolve(destination);if(existsSync(target))throw Error('Restore requires a new, empty destination path.');
  mkdirSync(join(target,'tenants'),{recursive:true,mode:0o700});
  try{for(const file of payload.files){const path=join(target,file.path);writeFileSync(path,Buffer.from(file.data,'base64'),{mode:0o600,flag:'wx'});check(path);const db=new DatabaseSync(path);db.exec('DELETE FROM sessions');db.close();}return{files:names.size,createdAt:payload.createdAt};}
  catch(error){rmSync(target,{recursive:true,force:true});throw error;}
}
export function backupSchedule(store,{password,directory=join(store.dir,'backups','scheduled'),retain=7}={}){
  const state={enabled:!!password,lastSuccess:null,error:null,offVolumeCopyVerified:false};
  function run(){if(!password)throw Error('Scheduled backups are not configured.');mkdirSync(directory,{recursive:true,mode:0o700});const file=join(directory,`${new Date().toISOString().replaceAll(':','-')}.relaxbk`);try{writeFileSync(file,makeBackup(store,password),{mode:0o600,flag:'wx'});state.lastSuccess=new Date().toISOString();state.error=null;for(const old of readdirSync(directory).filter(f=>f.endsWith('.relaxbk')).sort().slice(0,-retain))rmSync(join(directory,old));return file;}catch(error){state.error='Backup failed; operator review required.';throw error;}}
  const safeRun=()=>{try{run();}catch{console.error('Scheduled Relax backup failed.');}};
  const timer=password?setInterval(safeRun,24*60*60*1000):null;timer?.unref();
  if(password)safeRun();
  return{status:()=>({...state}),run,download:()=>makeBackup(store,password),close:()=>clearInterval(timer)};
}
