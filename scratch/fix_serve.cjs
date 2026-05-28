const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/index.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Replace export default { fetch... } with the proper Cron endpoint and serve() call
const nodeServeStr = `// --- Cron Endpoint ---
app.post('/api/cron', async (c) => {
  const authHeader = c.req.header('Authorization');
  const cronSecret = ENV.CRON_SECRET;
  if (!cronSecret || authHeader !== \`Bearer \${cronSecret}\`) {
    console.warn('⚠️ Unauthorized cron access attempt');
    return c.text('Unauthorized', 401);
  }
  
  await handleScheduled({}, ENV);
  return c.text('Cron ok');
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;
console.log(\`Server is running on port \${port}\`);
import { serve } from '@hono/node-server';
serve({
  fetch: app.fetch,
  port
});
`;

code = code.replace(/export default \{[\s\S]*?ctx\.waitUntil\(handleScheduled\(event, env\)\)[\s\S]*?\}/, nodeServeStr);

fs.writeFileSync(filePath, code);
console.log('Successfully replaced export with serve()');
