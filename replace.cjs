const fs = require('fs');
let code = fs.readFileSync('src/index.ts', 'utf8');

const regex1 = /app\.get\('\/api\/mypage\/gallery', async \(c\) => \{[\s\S]*?\} catch \(e\) \{ return c\.json\(\{ error: 'Invalid Session' \}, 401\) \}/g;
const regex2 = /app\.post\('\/api\/mypage\/delete-print', async \(c\) => \{[\s\S]*?\} catch \(e\) \{ return c\.json\(\{ error: 'Invalid Session' \}, 401\) \}/g;
const regex3 = /app\.post\('\/api\/mypage\/unlock-print', async \(c\) => \{[\s\S]*?\} catch \(e\) \{ return c\.json\(\{ error: 'Invalid Session' \}, 401\) \}/g;

const rep1 = `app.post('/api/mypage/gallery', async (c) => {\n  const body = await c.req.json().catch(() => null);\n  const userId = body?.userId;\n  if (!userId) return c.json({ error: 'Unauthorized' }, 401);`;
const rep2 = `app.post('/api/mypage/delete-print', async (c) => {\n  const body = await c.req.json().catch(() => null);\n  const userId = body?.userId;\n  if (!userId) return c.json({ error: 'Unauthorized' }, 401);`;
const rep3 = `app.post('/api/mypage/unlock-print', async (c) => {\n  const body = await c.req.json().catch(() => null);\n  const userId = body?.userId;\n  if (!userId) return c.json({ error: 'Unauthorized' }, 401);`;

code = code.replace(regex1, rep1);
code = code.replace(regex2, rep2);
code = code.replace(regex3, rep3);

fs.writeFileSync('src/index.ts', code);
console.log('Replaced correctly!');
