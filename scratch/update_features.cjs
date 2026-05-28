const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/index.ts');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add CRON_SECRET to Bindings
code = code.replace(
  /LINE_CHANNEL_ID: string\s*\n\s*\}/,
  'LINE_CHANNEL_ID: string\n  CRON_SECRET: string\n}'
);

// 2. Add TAG_DICTIONARY and normalizeTags
const tagDictCode = `
// --- タグ正規化辞書 (Canonical ID + Alias) ---
const TAG_DICTIONARY: { id: string; aliases: string[] }[] = [
  { id: 'EVENT_SPORTS_DAY',       aliases: ['運動会', '体育祭', 'スポーツ大会', '体育発表会'] },
  { id: 'EVENT_FIELD_TRIP',       aliases: ['遠足', '校外学習', '社会見学', '課外学習', '自然教室'] },
  { id: 'EVENT_PARENTS_MEETING',  aliases: ['保護者会', '懇談会', '懇親会', '父母会', 'PTA', '保護者懇談'] },
  { id: 'EVENT_CLASS_VISIT',      aliases: ['授業参観', '参観日', '学習参観', '公開授業', '授業公開'] },
  { id: 'EVENT_INTERVIEW',        aliases: ['個人面談', '三者面談', '教育相談', '面談', '個別面談'] },
  { id: 'EVENT_HANDOVER_DRILL',   aliases: ['引き渡し訓練', '引渡し訓練', '緊急引渡し', '引き渡し'] },
  { id: 'EVENT_GRADUATION',       aliases: ['卒業式', '卒園式', '修了式', '卒業'] },
  { id: 'EVENT_ENTRANCE',         aliases: ['入学式', '入園式', '始業式', '入学'] },
  { id: 'EVENT_SCHOOL_TRIP',      aliases: ['修学旅行', '林間学校', '宿泊学習', '宿泊行事'] },
  { id: 'EVENT_CULTURE_FESTIVAL', aliases: ['文化祭', '学芸会', '学習発表会', '音楽会', '展覧会', '作品展'] },
  { id: 'EVENT_SCHOOL_EXAM',      aliases: ['テスト', '試験', '定期考査', '学力調査', '実力テスト'] },
  { id: 'EVENT_COLLECTION',       aliases: ['集金', '納金', '口座振替'] },
  { id: 'EVENT_HEALTH_CHECK',     aliases: ['健康診断', '身体測定', '歯科検診', '眼科検診', '内科検診', '検診'] },
  { id: 'EVENT_CLEANUP',          aliases: ['大掃除', '掃除', 'クリーン活動'] },
  { id: 'EVENT_HOLIDAY',          aliases: ['休校', '臨時休校', '休園', '学校閉庁', '振替休日'] },
];

function normalizeTag(rawTag: string): string {
  const cleaned = rawTag.trim();
  for (const entry of TAG_DICTIONARY) {
    if (entry.aliases.some(alias => cleaned.includes(alias) || alias.includes(cleaned))) {
      return entry.id;
    }
  }
  return 'OTHER';
}

function normalizeTags(rawTags: string[]): string[] {
  if (!rawTags || rawTags.length === 0) return ['OTHER'];
  return [...new Set(rawTags.map(normalizeTag))];
}

// --- Routes ---`;
code = code.replace('// --- Routes ---', tagDictCode);

// 3. Apply normalization to tags when saving to calendar_events
const undoCode = `             // DB保存: Undo用
             if (registeredEvents.length > 0) {
               await supabase.from('calendar_events').insert(
                 registeredEvents.map(ev => ({
                   user_id: userId,
                   google_event_id: ev.googleId,
                   source_message_id: targetMsgId,
                   summary: ev.summary,
                   start_time: ev.start
                 }))
               )
             }`;
const updatedUndoCode = `             // DB保存: Undo用
             if (registeredEvents.length > 0) {
               await supabase.from('calendar_events').insert(
                 registeredEvents.map(ev => ({
                   user_id: userId,
                   google_event_id: ev.googleId,
                   source_message_id: targetMsgId,
                   summary: ev.summary,
                   start_time: ev.start,
                   tags: normalizeTags(ev.tags || [])
                 }))
               )
             }`;
code = code.replace(undoCode, updatedUndoCode);

// 4. Wrap scheduled task with /api/cron and add Secret Header check, and fix serve
const workerExportStr = `export default {
  fetch: app.fetch,
  scheduled(event: any, env: Bindings, ctx: any) {
    ctx.waitUntil(handleScheduled(event, env))
  }
}`;
const nodeServeStr = `// --- Cron Endpoint ---
app.post('/api/cron', async (c) => {
  const authHeader = c.req.header('Authorization')
  const cronSecret = ENV.CRON_SECRET
  if (!cronSecret || authHeader !== \`Bearer \${cronSecret}\`) {
    console.warn('Unauthorized cron access attempt')
    return c.text('Unauthorized', 401)
  }
  
  await handleScheduled({}, ENV)
  return c.text('Cron ok')
})

const port = process.env.PORT ? parseInt(process.env.PORT) : 8080
console.log(\`Server is running on port \${port}\`)
serve({
  fetch: app.fetch,
  port
})`;
code = code.replace(workerExportStr, nodeServeStr);

fs.writeFileSync(filePath, code);
console.log('Successfully updated index.ts');
