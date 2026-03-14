const Anthropic = require("@anthropic-ai/sdk");
const { detectLanguage } = require("../utils/language");

const anthropic = new Anthropic();

async function identifyExpertsWithAI(candidates, query, allChannelNames = [], userTitles = {}, negativeExpertIds = [], suggestedExpertIds = [], miniappOwners = []) {
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

  const miniappSection = miniappOwners.length
    ? `\nMiniapp ownership (Squad → Miniapp → EM → PM):\n${miniappOwners.map((m) => `- ${m.miniapp} (${m.squad}) → EM: ${m.em}, PM: ${m.pm}`).join("\n")}`
    : "";

  const negativeSection = negativeExpertIds.length
    ? `\nFor this specific topic only, a colleague indicated these users were not the right match: ${negativeExpertIds.join(", ")} — avoid ranking them for this query. They may still be experts on other topics.`
    : "";
  const suggestedSection = suggestedExpertIds.length
    ? `\nA colleague explicitly identified these people as the right experts for this topic: ${suggestedExpertIds.join(", ")} — treat this as a strong signal and include them in the top results even if their message history on this topic is limited.`
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
   If their role/title is relevant, mention it naturally and wrap the role/title in Slack bold (*role*). Example: "Como *Head of Finance*, tus mensajes sobre payroll muestran..."
   If their messages are from PRIVATE channels, do NOT quote them — just acknowledge their expertise without specifics.

3. If miniapp ownership data is provided and the query seems to be about one of those miniapps (exact or similar name/topic), include a "miniappMatch" field:
   - Match the closest miniapp name
   - Set emName and pmName from the ownership data
   - If query language suggests a technical issue → set "type": "technical"; if product/UX/feature → "type": "product"; if unclear → "type": "both"
   If the query is not about any miniapp, omit "miniappMatch" entirely.

4. Suggest up to 3 relevant channel names:
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
  "suggestedChannels": ["<channel-name>"],
  "miniappMatch": {
    "miniapp": "<matched miniapp name>",
    "squad": "<squad name>",
    "emName": "<EM full name>",
    "pmName": "<PM full name>",
    "type": "<'technical' | 'product' | 'both'>"
  }
}

If no relevant experts found, return experts as [].
Include "miniappMatch" only if the query is clearly about a specific miniapp.${miniappSection}${negativeSection}${suggestedSection}`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  console.log("[aiRanking] raw response:", text.slice(0, 500));
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { lang: hintLang, experts: [], suggestedChannels: [] };

  const result = JSON.parse(jsonMatch[0]);
  return {
    lang: result.lang || hintLang,
    experts: result.experts || [],
    suggestedChannels: result.suggestedChannels || [],
    miniappMatch: result.miniappMatch || null,
  };
}

module.exports = { identifyExpertsWithAI };
