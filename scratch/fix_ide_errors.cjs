const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/index.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Move import { serve } to top and add dotenv
if (!code.includes("import { config } from 'dotenv'")) {
  code = "import { serve } from '@hono/node-server'\nimport { config } from 'dotenv'\nconfig()\n" + code;
}
// Remove any 'import { serve }' from the bottom
code = code.replace(/import\s+\{\s*serve\s*\}\s+from\s+'@hono\/node-server';?\r?\n?/, '');

// 2. Define ENV variable after GoogleTokenResponse if it doesn't exist
if (!code.includes("const ENV = process.env as unknown as Bindings")) {
  code = code.replace(
    /(type GoogleTokenResponse = \{[\s\S]*?\r?\n\}\r?\n)/,
    match => match + "\nconst ENV = process.env as unknown as Bindings\n"
  );
}

fs.writeFileSync(filePath, code);
console.log('Fixed IDE errors in index.ts');
