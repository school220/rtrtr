import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destDir = path.resolve(__dirname, 'dist/db');
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
fs.copyFileSync(
  path.resolve(__dirname, 'src/db/schema.sql'),
  path.resolve(destDir, 'schema.sql')
);
