const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI('AIzaSyBpWVRhDjK6XBP54sTLdEZ4qZiJmY5bUZE');

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    const result = await model.generateContent("Hello, world!");
    console.log("Success:", result.response.text());
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
