const fs = require('fs');
const path = require('path');

const indexTsPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(indexTsPath, 'utf8');

const badCode = `  await supabase.from('google_auth').upsert({
    user_id: userId,
    refresh_token: refreshToken,
    access_token: tokens.access_token,
    expiry_date: Date.now() + (tokens.expires_in * 1000)
  })
  
  const successHtml = \`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>連携完了</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f4f6f8; margin: 0; }
    .card { background: white; padding: 3rem 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
    h2 { color: #1DB446; margin-bottom: 1rem; font-weight: bold; }
    p { color: #555; line-height: 1.6; margin-bottom: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎉</div>
    <h2>連携完了！</h2>
    <p>Googleカレンダーとの連携が正常に完了しました。<br><br><strong>このブラウザ画面を閉じて、LINEアプリにお戻りください。</strong></p>
  </div>
</body>
</html>
  \`
  return c.html(successHtml)
})
// src/index.ts の app.get('/liff/entry') を書き換え`;

const fixedCode = `  const { data: existing } = await supabase.from('google_auth').select('refresh_token').eq('user_id', userId).single()
  const refreshToken = tokens.refresh_token ?? existing?.refresh_token

  if (!refreshToken) return c.text('Error: No Refresh Token. Please revoke app access and try again.', 400)

  await supabase.from('users').upsert({ line_user_id: userId, display_name: 'User' })
  await supabase.from('google_auth').upsert({
    user_id: userId,
    refresh_token: refreshToken,
    access_token: tokens.access_token,
    expiry_date: Date.now() + (tokens.expires_in * 1000)
  })
  
  const successHtml = \`
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>連携完了</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: #f4f6f8; margin: 0; }
    .card { background: white; padding: 3rem 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; }
    h2 { color: #1DB446; margin-bottom: 1rem; font-weight: bold; }
    p { color: #555; line-height: 1.6; margin-bottom: 2rem; }
    .icon { font-size: 4rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎉</div>
    <h2>連携完了！</h2>
    <p>Googleカレンダーとの連携が正常に完了しました。<br><br><strong>このブラウザ画面を閉じて、LINEアプリにお戻りください。</strong></p>
  </div>
</body>
</html>
  \`
  return c.html(successHtml)
})

// --- Settings UI (LIFF Version) ---

// 1. LIFF エントリーポイント (フロントエンド)
// src/index.ts の app.get('/liff/entry') を書き換え`;

// Replace fuzzy due to line endings
const cleanStr = (s) => s.replace(/\r\n/g, '\n').trim();

let didFix = false;
const idx = content.indexOf('  if (tokens.error) return c.text(\'Auth Error\', 400)');
if (idx > -1) {
  const startIdx = idx + '  if (tokens.error) return c.text(\'Auth Error\', 400)\n\n  const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY)\n'.length;
  // Let's just do a regex replace to be safe.
}

content = content.replace(/const supabase = createClient\(ENV\.SUPABASE_URL, ENV\.SUPABASE_KEY\)([\s\S]*?)\/\/ src\/index\.ts の app\.get\('\/liff\/entry'\) を書き換え/, 
  'const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_KEY)\n' + fixedCode);

fs.writeFileSync(indexTsPath, content, 'utf8');
console.log('Fixed auth callback!');
