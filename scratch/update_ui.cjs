const fs = require('fs');
const path = require('path');

const indexTsPath = path.join(__dirname, '../src/index.ts');
let content = fs.readFileSync(indexTsPath, 'utf8');

const oldText = "await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: `連携が必要です👇\\n${lpUrl}` }] })";

const newText = `await client.replyMessage({
                  replyToken: event.replyToken,
                  messages: [{
                    type: 'flex',
                    altText: 'Google連携が必要です',
                    contents: {
                      type: 'bubble',
                      body: {
                        type: 'box',
                        layout: 'vertical',
                        spacing: 'md',
                        contents: [
                          { type: 'text', text: 'Google連携が必要です🔐', weight: 'bold', size: 'md', color: '#1DB446' },
                          { type: 'text', text: '予定をカレンダーに登録するため、アカウントを連携してください。', wrap: true, size: 'sm', color: '#666666' }
                        ]
                      },
                      footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                          {
                            type: 'button',
                            style: 'primary',
                            color: '#1DB446',
                            action: { type: 'uri', label: '連携スタート🚀', uri: lpUrl }
                          }
                        ]
                      }
                    }
                  }]
                })`;

if (content.includes(oldText)) {
  content = content.replace(oldText, newText);
  fs.writeFileSync(indexTsPath, content, 'utf8');
  console.log('Successfully updated UI!');
} else {
  console.log('Could not find the target text to replace.');
}
