import {readFileSync} from 'node:fs';
import {restoreBackup} from '../server/backups.mjs';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw Error('Usage: BACKUP_KEY=… node scripts/restore.mjs backup.relaxbk NEW_DATA_DIR');
console.log(restoreBackup(readFileSync(source),destination,process.env.BACKUP_KEY));
