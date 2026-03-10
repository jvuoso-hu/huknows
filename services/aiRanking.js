const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

async function identifyExpertsWithAI(candidates, query) {
  if (!candidates.length) return { lang: "es", experts: [] };

  const messageList = candidates
    .map((m) => `[${m.userId} | #${m.channelName}]: ${m.text.slice(0, 300).replace(/\n/g, " ")}`)
    .join("\n");

  const prompt = `You are analyzing internal Slack messages to identify the top experts on a topic.

Topic: "${query}"

Slack messages:
${messageList}

Identify up to 3 people who demonstrate the most knowledge or experience on this topic.

Prioritize people who:
- Explain concepts or answer other people's questions
- Show hands-on experience or depth of knowledge
- Have discussed the topic in multiple messages

Do NOT prioritize people who just mention the topic without showing knowledge.

Return ONLY valid JSON, no other text:
{
  "lang": "<detect the language of the topic query: 'es' or 'en'>",
  "experts": [
    {
      "userId": "<slack user id>",
      "score": <integer 1-10>,
      "confidence": "<respond in the detected language: 'Coincidencia fuerte'|'Buena coincidencia'|'Posible coincidencia' for es, or 'Strong match'|'Good match'|'Possible match' for en>",
      "explanation": "<one sentence in the detected language: why this person is relevant, grounded in what they actually said>",
      "exampleText": "<the most relevant snippet from their messages, max 120 chars>"
    }
  ]
}

If no relevant experts are found, return { "lang": "<detected>", "experts": [] }.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { lang: "es", experts: [] };

  return JSON.parse(jsonMatch[0]);
}

module.exports = { identifyExpertsWithAI };
