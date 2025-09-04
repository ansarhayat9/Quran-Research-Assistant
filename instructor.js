import { GoogleGenAI } from "@google/genai";
import { config, validateConfig } from "./config.js";

// Validate configuration first
if (!validateConfig()) {
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: config.apiKey });

// Helper function to delay execution
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function buildPrompt(userQuestion) {
  const q = userQuestion.trim();
  const lower = q.toLowerCase();
  const looksLikeCountQuery = /(how many|count|kitni|kitne|times).*\b(word|ayat|verses?|mentions?|dafa|martaba)/i.test(lower);
  const looksLikeWordQuery = /(word|jhoot|lie|truth|mercy|rahmah|sabr|patience|forgive|maghfirah|shirk|tawbah|iman|kufr)/i.test(lower);

  let guidance = `\n\nPlease ensure the answer is medium length, structured, and includes a short 'References' section with explicit Quran citations like SurahName Surah:Ayah and quran.com links. If unsure about counts, state uncertainty and provide representative verses and a search link.`;

  if (looksLikeCountQuery || looksLikeWordQuery) {
    guidance += `\nIf the query is about a word frequency, note that counts vary with Arabic morphology and translations. Provide an approximate count only if confident; otherwise, list 3–6 key verses with brief context and include https://quran.com/search?q={term}.`;
  }

  return `${q}${guidance}`;
}

async function tryModel(modelName, question) {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: buildPrompt(question),
      config: {
        systemInstruction: config.systemInstruction,
      },
    });
    return { success: true, response, model: modelName };
  } catch (error) {
    return { success: false, error, model: modelName };
  }
}

async function main() {
  // Sample Quran question - you can change this to ask different questions
  const question = "tell me about cricket and England. ";
  console.log(`📖  Quran Assistant`);
  console.log(`📚  Asking: "${question}"`);
  console.log("🔄  Seeking Quranic references...\n");

  // Try each model in order
  for (let i = 0; i < config.models.length; i++) {
    const model = config.models[i];
    console.log(`📡  Consulting model: ${model}`);
    
    const result = await tryModel(model, question);
    
    if (result.success) {
      console.log(`✅  Answer received from ${model}!`);
      console.log("\n📘  Response:");
      console.log("=".repeat(60));
      console.log(result.response.text);
      console.log("=".repeat(60));
      return;
    } else {
      console.log(`❌  Unable to access ${model}: ${result.error.message}`);
      
      if (result.error.status === 503) {
        console.log("⚠️  Service temporarily unavailable, trying alternative source...");
      }
      
      // Add delay between attempts (except for the last one)
      if (i < config.models.length - 1) {
        console.log(`⏳  Waiting ${config.retryDelay/1000}s before next consultation...`);
        await delay(config.retryDelay);
      }
    }
  }
  
  // If all models failed
  console.log("\n💥  Unable to access models at this time!");
  console.log("💡  Possible solutions:");
  console.log("   1. Wait a few minutes and try again");
  console.log("   2. Check Google AI Studio status: https://status.ai.google.dev/");
  console.log("   3. Verify your API key is valid");
  console.log("   4. Check your internet connection");
}

main().catch(error => {
  console.error("💥  Unexpected error:", error.message);
  process.exit(1);
});