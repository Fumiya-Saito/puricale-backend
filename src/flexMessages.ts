import { FlexBubble, FlexComponent, Message, FlexBox } from '@line/bot-sdk'

// 文字数制限ヘルパー
const safeStr = (str: string | any, max: number) => {
  if (!str) return ''
  const s = String(str)
  return s.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

// 日付フォーマットヘルパー (例: 02/09 10:00)
const formatDate = (isoStart: string) => {
  if (!isoStart) return '不明'
  const datePart = isoStart.slice(5, 10).replace('-', '/')
  const timePart = (isoStart.includes('T') && isoStart.length > 10) ? isoStart.slice(11, 16) : ''
  // 時間が00:00なら日付だけ、それ以外は時間も表示
  return timePart === '00:00' ? datePart : (timePart ? `${datePart} ${timePart}` : datePart)
}

// 1. 【改修】登録された予定の一覧リスト（カレンダー名でグループ化）
function createRegisteredListBubble(events: any[]): FlexBubble {
  const MAX_DISPLAY = 10
  const displayEvents = events.slice(0, MAX_DISPLAY)
  const remaining = events.length - MAX_DISPLAY

  // カレンダー名（マッチした子供名）でグループ化
  const groupedEvents = displayEvents.reduce((acc, ev) => {
    const key = ev.matchedChildName || '家族共有'
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {} as Record<string, any[]>)

  const bodyContents: FlexComponent[] = []

  for (const [calName, evs] of Object.entries(groupedEvents)) {
    // グループヘッダー（カレンダー名）
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      margin: bodyContents.length === 0 ? 'none' : 'md',
      contents: [
        { type: 'text', text: `✅ ${calName}`, weight: 'bold', size: 'sm', color: '#0367D3' }
      ]
    })
    
    // そのカレンダーに属するイベントリスト
    ;(evs as any[]).forEach((ev: any) => {
      bodyContents.push({
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        margin: 'sm',
        contents: [
          { type: 'text', text: formatDate(ev.start), color: '#555555', size: 'sm', flex: 2 },
          { type: 'text', text: safeStr(ev.summary, 20), color: '#333333', size: 'sm', flex: 5, wrap: true }
        ]
      })
    })
  }

  // 「...他 N件」の表示
  if (remaining > 0) {
    bodyContents.push({
      type: 'text',
      text: `...他 ${remaining}件`,
      size: 'xs',
      color: '#aaaaaa',
      align: 'end',
      margin: 'md'
    })
  }

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `📅 登録リスト (${events.length}件)`, weight: 'bold', color: '#0367D3' }
      ],
      backgroundColor: '#eef5ff'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        ...bodyContents,
        { type: 'separator', margin: 'lg' },
        {
           type: 'text',
           text: '※修正はGoogleカレンダーで行ってください',
           size: 'xxs',
           color: '#aaaaaa',
           margin: 'md',
           align: 'center'
        }
      ],
      spacing: 'xs'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'link',
          height: 'sm',
          action: {
            type: 'uri',
            label: 'Googleカレンダーを開く',
            uri: 'https://calendar.google.com/calendar/r?openExternalBrowser=1'
          }
        }
      ]
    }
  }
}

// 2. 結果まとめ用カード (除外レポート)
function createSummaryBubble(successCount: number, ignoredEvents: any[], messageId: string): FlexBubble {
  // 除外リストも多めに表示 (最大10件)
  const MAX_DISPLAY = 10
  
  const ignoredTextList = ignoredEvents.slice(0, MAX_DISPLAY)
    .map(ev => `・${safeStr(ev.summary, 20)}`)
    .join('\n')
  
  const moreText = ignoredEvents.length > MAX_DISPLAY 
    ? `\n...他 ${ignoredEvents.length - MAX_DISPLAY}件` 
    : ''
    
  const finalIgnoredText = ignoredTextList + moreText

  const bodyContents: FlexComponent[] = []

  // 成功数・除外数のヘッダー
  bodyContents.push({
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: `✅ 登録: ${successCount}件`, weight: 'bold', flex: 1 },
      { type: 'text', text: `🗑️ 除外: ${ignoredEvents.length}件`, color: '#888888', flex: 1 }
    ]
  })

  // 除外リスト本体
  if (ignoredEvents.length > 0) {
    bodyContents.push({ type: 'separator' }) 
    bodyContents.push({ type: 'text', text: '▼除外された予定', weight: 'bold', color: '#aaaaaa', wrap: true })
    bodyContents.push({ type: 'text', text: finalIgnoredText, color: '#aaaaaa', wrap: true, size: 'xs' })
  }

  bodyContents.push({ type: 'separator' })
  bodyContents.push({ type: 'text', text: '間違いがありましたか？', align: 'center', color: '#aaaaaa', size: 'xs' })

  // フッターボタン
  const footerContents: FlexComponent[] = [
    {
      type: 'button',
      style: 'secondary',
      color: '#ff3333',
      height: 'sm',
      action: {
        type: 'postback',
        label: '取り消す',
        data: `action=undo&msgId=${messageId}`,
        displayText: '今回の登録を取り消します'
      }
    }
  ]

  // ★ここを変更: 「救出する」→「これも登録する」
  if (ignoredEvents.length > 0) {
    footerContents.push({
      type: 'button',
      style: 'link',
      height: 'sm',
      action: {
        type: 'postback',
        label: '除外された予定も登録する', // ★分かりやすさ重視に変更
        data: `action=rescue&msgId=${messageId}`,
        displayText: '除外された予定も追加で登録します'
      }
    })
  }

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [{ type: 'text', text: '📊 完了レポート', weight: 'bold', color: '#666666' }],
      backgroundColor: '#f0f0f0'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      spacing: 'md'
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: footerContents,
      spacing: 'sm'
    }
  }
}

// 3. メイン生成関数
export function generateFlexMessages(keptEvents: any[], ignoredEvents: any[], messageId: string): Message[] {
  const messages: Message[] = []

  // 1通目: 登録リスト (Bubble)
  if (keptEvents.length > 0) {
    const listBubble = createRegisteredListBubble(keptEvents)
    messages.push({
      type: 'flex',
      altText: `📅 ${keptEvents.length}件の予定`,
      contents: listBubble
    })
  }

  // 2通目: 完了レポート (Bubble)
  // イベントが0件でも、除外があればレポートは出す
  if (keptEvents.length > 0 || ignoredEvents.length > 0) {
    const summaryBubble = createSummaryBubble(keptEvents.length, ignoredEvents, messageId)
    messages.push({
      type: 'flex',
      altText: '📊 完了レポート',
      contents: summaryBubble
    })
  }

  return messages
}

// 4. 【新設】解析開始の確認用バブル
export function createConfirmBubble(messageId: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '📷 画像を受け取りました',
          weight: 'bold',
          size: 'md',
          color: '#1DB446'
        },
        {
          type: 'text',
          text: '学校プリントの解析を開始しますか？\n（関係ない画像の場合は無視してください）',
          size: 'xs',
          color: '#aaaaaa',
          wrap: true,
          margin: 'md'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          action: {
            type: 'postback',
            label: '解析する',
            data: `action=analyze&msgId=${messageId}`, // ここで画像のIDを引き継ぐ
            displayText: '解析を開始します'
          }
        }
      ]
    }
  }
}

// 5. 【新設】設定画面への誘導カード
export function createSettingsBubble(liffUrl: string): any {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '⚙️ プリカレ設定',
          weight: 'bold',
          color: '#ffffff',
          size: 'md'
        }
      ],
      backgroundColor: '#2c3e50', // ブランドカラー(濃いネイビー)で信頼感を
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '以下の設定を変更できます',
          size: 'xs',
          color: '#aaaaaa',
          margin: 'none'
        },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'md',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                { type: 'text', text: '✅', flex: 1, size: 'xs' },
                { type: 'text', text: '子供の学年・クラス設定', flex: 9, size: 'sm', color: '#666666' }
              ]
            },
            {
              type: 'box',
              layout: 'baseline',
              contents: [
                { type: 'text', text: '📅', flex: 1, size: 'xs' },
                { type: 'text', text: '保存先カレンダーの変更', flex: 9, size: 'sm', color: '#666666' }
              ]
            }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#2c3e50',
          action: {
            type: 'uri',
            label: '設定画面を開く',
            uri: liffUrl
          }
        },
        {
          type: 'text',
          text: '※本人確認のためLINEログインします',
          size: 'xxs',
          color: '#aaaaaa',
          align: 'center',
          margin: 'md'
        }
      ]
    }
  }
}

// src/flexMessages.ts の一番下に追加

// 6. ヘルプ/使い方ガイド
export function createHelpBubble(settingsUrl: string): any {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '🔰 プリカレの使い方', weight: 'bold', color: '#ffffff', size: 'md' }
      ],
      backgroundColor: '#27ae60', // 親しみやすい緑色
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '学校のプリントを写真に撮って送るだけで、Googleカレンダーに予定を登録します📅',
          wrap: true,
          size: 'sm',
          color: '#555555'
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '📸 上手な使い方のコツ', weight: 'bold', size: 'sm', color: '#27ae60' },
            { type: 'text', text: '・プリント全体が写るように撮影', size: 'xs', color: '#666666', wrap: true },
            { type: 'text', text: '・明るい場所で、文字がブレないように', size: 'xs', color: '#666666', wrap: true },
            { type: 'text', text: '・一度に1枚ずつ送信してください', size: 'xs', color: '#666666', wrap: true }
          ]
        },
        { type: 'separator', margin: 'lg' },
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          spacing: 'sm',
          contents: [
            { type: 'text', text: '⚙️ 設定・変更', weight: 'bold', size: 'sm', color: '#27ae60' },
            { type: 'text', text: 'お子様の学年設定や、保存先カレンダーの変更はこちらから👇', size: 'xs', color: '#666666', wrap: true }
          ]
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#27ae60',
          action: {
            type: 'uri',
            label: '設定画面を開く',
            uri: settingsUrl
          }
        }
      ]
    }
  }
}

// 7. 【新設】過去の記録発見通知バブル
export function createPastRecordBubble(eventName: string, printId: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '💡 去年の記録を発見！', weight: 'bold', color: '#ffffff', size: 'md' }
      ],
      backgroundColor: '#f39c12',
      paddingAll: 'md'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `去年の【${safeStr(eventName, 15)}】の記録（持ち物リストなど）が見つかりました！`,
          wrap: true,
          size: 'sm',
          color: '#333333'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#f39c12',
          action: {
            type: 'postback',
            label: '記録を見る',
            data: `action=restore_past&printId=${printId}`,
            displayText: '去年の記録を確認します'
          }
        }
      ]
    }
  }
}

// 8. 【新設】復元された過去プリント表示用バブル
export function createRestoredPrintBubble(eventName: string, text: string, imageUrl: string | null, remainingTickets: number | null = null): FlexBubble {
  const contents: FlexComponent[] = [
    {
      type: 'text',
      text: '▼ 読み取られていたテキスト',
      weight: 'bold',
      size: 'xs',
      color: '#aaaaaa',
      margin: 'md'
    },
    {
      type: 'text',
      text: safeStr(text, 500) || 'テキストデータなし',
      wrap: true,
      size: 'sm',
      color: '#333333',
      margin: 'sm'
    }
  ]

  if (imageUrl) {
    contents.unshift({
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '3:4',
      aspectMode: 'cover',
      action: {
        type: 'uri',
        label: '画像を拡大',
        uri: imageUrl
      }
    })
  }

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: `🔙 復元: 去年の【${safeStr(eventName, 15)}】`, weight: 'bold', color: '#ffffff', size: 'sm' }
      ],
      backgroundColor: '#8e44ad',
      paddingAll: 'md'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: contents
    },
    footer: remainingTickets !== null ? {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: `🎟️ 残りお試しチケット: ${remainingTickets}枚`,
          size: 'xs',
          color: '#aaaaaa',
          align: 'center'
        }
      ]
    } : undefined
  }
}

// 9. 【新設】チケット不足時のプレミアム案内バブル
export function createNoTicketBubble(premiumUrl: string): FlexBubble {
  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '🎟️ チケットが足りません', weight: 'bold', color: '#ffffff', size: 'md' }
      ],
      backgroundColor: '#e74c3c', // Red for error/attention
      paddingAll: 'md'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '過去のプリント（ナレッジ）を復元するためのお試しチケットを使い切りました。',
          wrap: true,
          size: 'sm',
          color: '#333333',
          margin: 'sm'
        },
        {
          type: 'text',
          text: 'プレミアムプラン（月額480円）に登録すると、過去のプリントが無制限に見放題になります！',
          wrap: true,
          size: 'sm',
          weight: 'bold',
          color: '#e74c3c',
          margin: 'md'
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          height: 'sm',
          color: '#e74c3c',
          action: {
            type: 'uri',
            label: 'プレミアムプラン詳細',
            uri: premiumUrl
          }
        }
      ]
    }
  }
}