const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic();

async function identifyExpertsWithAI(candidates, query, lang = "es") {
  if (!candidates.length) return [];

  const messageList = candidates
    .map((m) => `[${m.userId} | #${m.channelName}]: ${m.text.slice(0, 300).replace(/\n/g, " ")}`)
    .join("\n");

  const langInstruction = lang === "en"
    ? "Respond in English."
    : "Responde en español.";

  const prompt = `You are analyzing internal Slack messages to identify the top experts on a topic. ${langInstruction}

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
[
  {
    "userId": "<slack user id>",
    "score": <integer 1-10>,
    "confidence": "<Strong match|Good match|Possible match>",
    "explanation": "<one sentence: why this person is relevant, grounded in what they actually said>",
    "exampleText": "<the most relevant snippet from their messages, max 120 chars>"
  }
]

If no relevant experts are found, return [].`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  return JSON.parse(jsonMatch[0]);
}

module.exports = { identifyExpertsWithAI };
