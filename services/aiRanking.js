const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

function guessLang(text) {
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es";
  if (/[àâçéèêëîïôùûü]/i.test(text)) return "fr";
  if (/[ãõ]/i.test(text)) return "pt";
  const enWords = new Set(["the", "for", "and", "with", "about", "how", "who", "what", "our", "from", "by", "has", "can", "into"]);
  const words = text.toLowerCase().split(/\s+/);
  return words.some((w) => enWords.has(w)) ? "en" : "es";
}

async function identifyExpertsWithAI(candidates, query) {
  const hintLang = guessLang(query);
  if (!candidates.length) return { lang: hintLang, experts: [], suggestedChannels: [] };

  const messageList = candidates
    .map((m) => `[${m.userId} | #${m.channelName}]: ${m.text.slice(0, 300).replace(/\n/g, " ")}`)
    .join("\n");

  const prompt = `You are analyzing internal Slack messages to identify experts on a topic.

Topic: "${query}"
Query language: ${hintLang} — respond in that language for all text fields.

Slack messages:
${messageList}

Tasks:
1. Identify up to 3 people who demonstrate the most knowledge on this topic.
   Prioritize people who explain concepts, answer questions, or show hands-on experience.
   Do NOT rank people who just mention the topic in passing.

2. For each expert, write a personalized "briefMessage" (2 sentences max) explaining specifically
   why they were selected, referencing what they actually said. This will be sent to them directly.

3. Identify up to 3 channel names where this topic has been discussed (even if no clear expert found).

Return ONLY valid JSON:
{
  "lang": "<ISO 639-1 code of the query language>",
  "experts": [
    {
      "userId": "<slack user id>",
      "score": <integer 1-10>,
      "confidence": "<in query language: e.g. 'Coincidencia fuerte' / 'Strong match'>",
      "explanation": "<one sentence in query language: why relevant>",
      "briefMessage": "<2 sentences in query language, personalized, referencing what they said>",
      "exampleText": "<most relevant snippet from their messages, max 120 chars>"
    }
  ],
  "suggestedChannels": ["<channel-name>", ...]
}

If no relevant experts found, return experts as [].`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { lang: hintLang, experts: [], suggestedChannels: [] };

  const result = JSON.parse(jsonMatch[0]);
  return {
    lang: result.lang || hintLang,
    experts: result.experts || [],
    suggestedChannels: result.suggestedChannels || [],
  };
}

module.exports = { identifyExpertsWithAI };
