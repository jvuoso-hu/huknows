const Anthropic = require("@anthropic-ai/sdk");
const { detectLanguage } = require("../utils/language");

const anthropic = new Anthropic();

async function identifyExpertsWithAI(candidates, query, allChannelNames = [], userTitles = {}, negativeExpertIds = [], suggestedExpertIds = []) {
  const hintLang = detectLanguage(query);
  if (!candidates.length && !allChannelNames.length) return { lang: hintLang, experts: [], suggestedChannels: [] };

  const messageList = candidates
    .map((m) => `[${m.userId}${m.isThread ? " | thread" : ""}${m.isPrivate ? " | PRIVATE" : ""} | #${m.channelName}]: ${m.text.slice(0, 300).replace(/\n/g, " ")}`)
    .join("\n");

  const titlesSection = Object.keys(userTitles).length
    ? `\nUser roles/titles:\n${Object.entries(userTitles).map(([id, title]) => `- ${id}: ${title}`).join("\n")}`
    : "";

  const channelNamesSection = allChannelNames.length
    ? `\nAll workspace channel names (use for fallback channel suggestions if no messages matched): ${allChannelNames.join(", ")}`
    : "";

  const langInstruction = hintLang === "en" ? "English — respond in English" : `${hintLang} — respond in that language`;

  const negativeSection = negativeExpertIds.length
    ? `\nUsers marked these experts as NOT helpful for this topic: ${negativeExpertIds.join(", ")} — avoid ranking them unless clearly the best option.`
    : "";
  const suggestedSection = suggestedExpertIds.length
    ? `\nUsers suggested these people as the right experts for this topic: ${suggestedExpertIds.join(", ")} — boost their score if they appear in messages.`
    : "";

  const prompt = `You are analyzing internal Slack messages to identify experts on a topic.

Topic: "${query}"
Query language: ${langInstruction}

Slack messages:
${messageList || "(none)"}
${titlesSection}
${channelNamesSection}

Tasks:
1. Identify up to 3 people who demonstrate the most knowledge on this topic.
   Prioritize people who explain concepts, answer questions, or show hands-on experience.
   Thread replies (marked "thread") are a stronger expertise signal — weight them more.
   If a user's role/title is relevant to the topic, use that as additional signal.
   If a user's role/title is clearly unrelated, you may rank them lower even if they posted.
   Do NOT rank people who just mention the topic in passing.

2. For each expert, write a personalized "briefMessage" (2 sentences max) explaining why they were selected.
   If their role/title is relevant, mention it naturally. Example: "Como Head of Finance, tus mensajes sobre payroll muestran..."
   If their messages are from PRIVATE channels, do NOT quote them — just acknowledge their expertise without specifics.

3. Suggest up to 3 relevant channel names:
   - Prefer channels where the topic was actually discussed in the messages above.
   - If none found, interpret the channel names list and suggest any whose name implies relevance to the topic.

Return ONLY valid JSON:
{
  "lang": "<ISO 639-1 code of the query language>",
  "experts": [
    {
      "userId": "<slack user id>",
      "score": <integer 1-10>,
      "confidence": "<in query language: e.g. 'Coincidencia fuerte' / 'Strong match' / 'Forte'>",
      "explanation": "<one sentence in query language: why relevant>",
      "briefMessage": "<2 sentences in query language, personalized, referencing what they said>",
      "exampleText": "<most relevant snippet from their messages, max 120 chars>"
    }
  ],
  "suggestedChannels": ["<channel-name>"]
}

If no relevant experts found, return experts as [].${negativeSection}${suggestedSection}`;

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
