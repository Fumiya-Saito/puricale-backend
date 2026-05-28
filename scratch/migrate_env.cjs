const fs = require('fs');
const path = require('path');

const indexTsPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(indexTsPath, 'utf8');

content = content.replace(/c\.env\./g, 'ENV.');

fs.writeFileSync(indexTsPath, content);
console.log('Replaced c.env. with ENV.');
