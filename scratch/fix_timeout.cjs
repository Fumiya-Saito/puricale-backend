const fs = require('fs');
const path = require('path');

const indexTsPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(indexTsPath, 'utf8');

const regex = /const result = await Promise\.race\(\[\s*generateContentWithRetry\(model, promptParts\),\s*new Promise<never>\(\(_, reject\) => setTimeout\(\(\) => reject\(new Error\('Timeout'\)\), 23000\)\)\s*\]\)/g;

content = content.replace(regex, "const result = await generateContentWithRetry(model, promptParts)");

fs.writeFileSync(indexTsPath, content, 'utf8');
console.log('Fixed timeout in index.ts');
