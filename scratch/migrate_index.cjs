const fs = require('fs');
const path = require('path');

const indexTsPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(indexTsPath, 'utf8');

// Add imports
if (!content.includes("@hono/node-server")) {
    content = content.replace(
        "import { Hono } from 'hono'",
        "import { serve } from '@hono/node-server'\nimport { config } from 'dotenv'\nconfig()\nimport { Hono } from 'hono'"
    );
}

// Add ENV
if (!content.includes("const ENV =")) {
    content = content.replace(
        "const app = new Hono<{ Bindings: Bindings }>()",
        "const ENV = process.env as unknown as Bindings\n\nconst app = new Hono<{ Bindings: Bindings }>()"
    );
}

// Fix waitUntil
content = content.replace(
    /c\.executionCtx\.waitUntil\([\s\S]*?handleEvents\([\s\S]*?\)\s*\.catch\([\s\S]*?\)\s*\)/,
    "handleEvents(body.events, ENV, c.req.url).catch(err => console.error('🚨 Global Error in handleEvents:', err))"
);

// Replace default export and scheduled with serve and POST route
const cronRegex = /\/\/ --- Scheduled Task \(Cron\) ---[\s\S]*?async function handleScheduled\(event: any, env: Bindings\) \{[\s\S]*?\}\s*export default \{[\s\S]*?\}/;

const serveCode = `// --- Scheduled Task (Cron) ---
app.post('/api/cron', async (c) => {
  await handleScheduled({}, ENV)
  return c.text('Cron ok')
})

async function handleScheduled(event: any, env: Bindings) {
`

content = content.replace(/\/\/ --- Scheduled Task \(Cron\) ---[\s\S]*?async function handleScheduled\(event: any, env: Bindings\) \{/, serveCode);

// Remove export default block at the bottom
content = content.replace(/export default \{\s*fetch: app\.fetch,\s*scheduled\(event: any, env: Bindings, ctx: any\) \{\s*ctx\.waitUntil\(handleScheduled\(event, env\)\)\s*\}\s*\}/, 
`const port = process.env.PORT ? parseInt(process.env.PORT) : 8080
console.log(\`Server is running on port \${port}\`)
serve({
  fetch: app.fetch,
  port
})`);

fs.writeFileSync(indexTsPath, content);
console.log('Modified index.ts for Cloud Run');
