import child_process from 'child_process';
import fs from 'fs';

fs.watch('comics', { recursive: true }, (event, file) => {
  child_process.execSync('npm run build');
});
