import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { config, validateConfig } from './config.js';

if (!validateConfig()) {
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Serve static frontend
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname)));

const ai = new GoogleGenAI({ apiKey: config.apiKey });

function buildPrompt(userQuestion, lang) {
  const q = (userQuestion || '').trim();
  const lower = q.toLowerCase();
  const looksLikeCountQuery = /(how many|count|kitni|kitne|times).*\b(word|ayat|verses?|mentions?|dafa|martaba)/i.test(lower);
  const looksLikeWordQuery = /(word|jhoot|lie|truth|mercy|rahmah|sabr|patience|forgive|maghfirah|shirk|tawbah|iman|kufr|جھوٹ|سچ|رحمت|صبر|ایمان)/i.test(lower);

  let guidance = `\n\nPlease ensure the answer is medium length, structured, and includes a short 'References' section with explicit Quran citations like SurahName Surah:Ayah and quran.com links. If unsure about counts, state uncertainty and provide representative verses and a search link.`;

  if (looksLikeCountQuery || looksLikeWordQuery) {
    guidance += `\nIf the query is about a word frequency, note that counts vary with Arabic morphology and translations. Provide an approximate count only if confident; otherwise, list 3–6 key verses with brief context and include https://quran.com/search?q={term}.`;
  }

  if (lang === 'ur') {
    guidance += `\nRespond in Urdu (اردو) with clear, respectful, and simple language.`;
  } else {
    guidance += `\nRespond in English with clear, respectful, and simple language.`;
  }

  return `${q}${guidance}`;
}

app.post('/api/ask', async (req, res) => {
  try {
    const { question, lang } = req.body || {};
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const response = await ai.models.generateContent({
      model: config.models[0] || 'gemini-1.5-flash',
      contents: buildPrompt(question, lang),
      config: {
        systemInstruction: config.systemInstruction,
      },
    });

    const text = response?.text || '';
    return res.json({ answer: text });
  } catch (error) {
    const status = error?.status || 500;
    return res.status(status).json({ error: error?.message || 'Server error' });
  }
});

// Serve index.html for root and unknown routes
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Quran Research API running on http://localhost:${PORT}`);
});
