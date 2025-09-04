export default async function handler(req, res) {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { question, lang } = req.body || {};
      if (!question || typeof question !== 'string') return res.status(400).json({ error: 'Question is required' });
  
      // Build prompt (same logic you use on server)
      const looksLikeCount = /(how many|count|kitni|kitne|times).*\b(word|ayat|verses?|mentions?|dafa|martaba)/i.test(question.toLowerCase());
      const looksLikeWord = /(word|jhoot|lie|truth|mercy|rahmah|sabr|patience|forgive|maghfirah|shirk|tawbah|iman|kufr|جھوٹ|سچ|رحمت|صبر|ایمان)/i.test(question.toLowerCase());
      let guidance = "\n\nPlease ensure the answer is medium length, structured, and includes a 'References' section with Surah:Ayah and quran.com links. If unsure about counts, state uncertainty and provide representative verses with a search link.";
      if (looksLikeCount || looksLikeWord) {
        guidance += "\nIf the query is about a word frequency, note counts vary with morphology/translations. Provide an approximate count only if confident; otherwise list 3–6 key verses and include https://quran.com/search?q={term}.";
      }
      guidance += lang === 'ur' ? "\nRespond in Urdu (اردو) clearly and respectfully." : "\nRespond in English clearly and respectfully.";
      const contents = `${question.trim()}${guidance}`;
  
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'GOOGLE_API_KEY not set' });
  
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: contents }] }],
          systemInstruction: { parts: [{ text: process.env.SYSTEM_INSTRUCTION || '' }] }
        })
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        return res.status(r.status).json({ error: e?.error?.message || 'Upstream error' });
      }
      const data = await r.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ answer });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Server error' });
    }
  }