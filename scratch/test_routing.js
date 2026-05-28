const childSettings = [
  { name: '長男', calendar_id: 'cal_brother', keywords: ['1年', '1-2'] },
  { name: '長女', calendar_id: 'cal_sister', keywords: ['3年'] }
];
const sharedCalendarId = 'cal_shared';
const userKeywords = []; // レガシー互換用（今回は使用しない）

// src/index.ts から抽出したロジック
const normalize = (str) => str.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                              .replace(/[-－ー]/g, '')
                              .replace(/[年組生]/g, '');

const testCases = [
  { target: '1年2組', desc: '長男のクラスに完全一致' },
  { target: '3年生', desc: '長女の学年に完全一致' },
  { target: '1年, 3年', desc: '両方に一致（共通イベント）' },
  { target: '全校児童', desc: '「全」を含む' },
  { target: '保護者対象', desc: '「保護者」を含む' },
  { target: '2年生', desc: 'どのキーワードにもマッチしない' },
  { target: '', desc: 'ターゲット空（指定なし）' },
  { target: '1年生以外', desc: '「以外」を含む（除外対象）' },
  { target: '１ー２', desc: '全角やハイフン表記（揺らぎ）' },
];

console.log('--- 自動振り分けロジック テスト結果 ---');

for (const tc of testCases) {
  const safeTarget = tc.target;
  let result = '家族共有 (cal_shared)';
  let isIgnored = false;

  if (safeTarget.includes('以外') || safeTarget.includes('除く')) {
    isIgnored = true;
  } else {
    let targetCalId = sharedCalendarId;
    let matchedChildName = '家族共有';
    const isAll = !safeTarget || safeTarget.includes('全') || safeTarget.includes('保護者');

    if (!isAll && childSettings.length > 0) {
      let bestMatch = null;
      for (const child of childSettings) {
        const cKeywords = child.keywords || [];
        const isMatch = cKeywords.some(kw => {
          if (safeTarget.includes(kw) || kw.includes(safeTarget)) return true;
          const nKw = normalize(kw);
          const nTarget = normalize(safeTarget);
          if (nKw.length < 2 || nTarget.length < 2) return false;
          return nTarget.includes(nKw) || nKw.includes(nTarget);
        });
        
        if (isMatch) {
          if (bestMatch) {
            bestMatch = null; // 複数マッチは共有にフォールバック
            break;
          }
          bestMatch = child;
        }
      }

      if (bestMatch && bestMatch.calendar_id) {
        targetCalId = bestMatch.calendar_id;
        matchedChildName = bestMatch.name;
      }
    }
    
    result = `${matchedChildName} (${targetCalId})`;
  }

  if (isIgnored) {
    console.log(`❌ [除外] 入力: "${tc.target}" -> 登録しない (${tc.desc})`);
  } else {
    console.log(`✅ [登録] 入力: "${tc.target}" -> ${result} (${tc.desc})`);
  }
}
