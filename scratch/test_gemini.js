const fs = require('fs');

async function main() {
  const apiKey = 'AIzaSyDD3olHt_mgaeXNKdNdYaUT7i4U-ZGmENs';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [{ text: "こんにちは！" }]
    }]
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    console.log('Status:', res.status);
    const data = await res.text();
    console.log('Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
