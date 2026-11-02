import { createApp } from './app.mjs';
const portArg=process.argv.indexOf('--port');
const port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT||3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT.');
const production=process.env.NODE_ENV==='production';
const origins=[process.env.PUBLIC_ORIGIN,process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:null].filter(Boolean);
for(const origin of origins)if(new URL(origin).origin!==origin || (production&&!origin.startsWith('https://')))throw new Error('Origins must be exact HTTPS origins in production.');
const {server,store}=await createApp({dataDir:process.env.DATA_DIR,production,origins,consoleUsername:process.env.CONSOLE_USERNAME,consolePassword:process.env.CONSOLE_PASSWORD});
server.listen(port,'0.0.0.0',()=>console.log(`Relax ready on port ${port}; platform and tenant migrations complete.`));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{
  server.close(()=>{store.close();process.exit(0);});
  setTimeout(()=>process.exit(1),10000).unref();
});
