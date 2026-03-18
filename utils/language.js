const SPANISH_CHARS = /[áéíóúüñ¿¡]/i;
const SPANISH_WORDS = new Set([
  "que", "con", "para", "como", "pero", "hay", "tiene", "desde",
  "quiero", "necesito", "sobre", "cual", "donde", "cuando", "quien",
  "alguien", "sabe", "conoce", "ayuda", "busco", "tema",
]);
const ENGLISH_WORDS = new Set([
  "what", "who", "how", "where", "when", "about", "with", "from",
  "need", "want", "find", "help", "know", "someone", "topic", "looking",
  "for", "the", "and", "our", "their", "clients", "users", "team",
  "by", "at", "into", "has", "have", "can", "does", "make", "get",
]);

function detectLanguage(text) {
  if (SPANISH_CHARS.test(text)) return "es";
  const words = text.toLowerCase().split(/\s+/);
  const esCount = words.filter((w) => SPANISH_WORDS.has(w)).length;
  const enCount = words.filter((w) => ENGLISH_WORDS.has(w)).length;
  return enCount > esCount ? "en" : "es";
}

const STRINGS = {
  es: {
    iKnow: (q) => `🤓☝🏻 Estoy analizando el conocimiento dentro de Hu para identificar a las personas que mejor pueden ayudarte con: _${q}_`,
    searching: (q) => `🔍 Buscando expertos en _${q}_...`,
    noExperts: (q) => `No encontré expertos para *${q}*.`,
    noQuery: "Usá el comando así: `/huknows <tema o problema>`",
    error: "Ocurrió un error buscando expertos.",
    connected: (name) => `🤝 Conectado con *${name}*. Chat abierto y brief enviado.`,
    connect: "Conectar",
    available: "Disponible",
    away: "Ausente",
    dndUntil: (t) => `No molestar hasta ${t}`,
    dnd: "No molestar",
    topExperts: (q) => `🏆 Mejores coincidencias: ${q}`,
    topExpertsHeader: "🏆 Mejores coincidencias para este tema",
    singleExpertHeader: "I know! Te sugiero que hables con:",
    activeIn: (channel) => `💬 Activo en #${channel}`,
    topicLabel: (q) => `📌 Tema: ${q}`,
    helpful: "✅ Sí, fue de gran utilidad",
    unhelpful: "❌ No, no fue de utilidad",
    skipSuggestion: "No sé, gracias igual",
    feedbackThanks: (name) => `🧠 ¡Gracias! Le sumamos puntos a *${name}* como experto en este tema.`,
    feedbackPrompt: (name) => `👆 ¿Te fue útil *${name}*?`,
    frequentBadge: (n) => `🔥 Búsqueda frecuente · ${n} ${n === 1 ? "persona encontró" : "personas encontraron"} esto útil`,
    tryChannels: "No encontré expertos claros, pero estos canales podrían ser el lugar indicado para preguntar:",
    noExpertsNoChannels: (q) => `No encontré expertos ni canales relevantes para *${q}*.`,
    briefGreeting: (name) => `👋🏻 ¡Hola ${name}!`,
    briefIdentified: (q) => `🧠 *HuKnows te identificó como una de las mejores personas para ayudar con este tema:* ${q}`,
    briefWhy: (reason) => `💡 ¿Por qué vos? ${reason}`,
    briefWhyChannel: (reason, channel) => `💡 ¿Por qué vos? ${reason} _(a través del canal #${channel})_`,
    briefWhyPrivate: (reason) => `💡 ¿Por qué vos? ${reason} 🔒`,
    briefWhyPrivateGeneric: `💡 ¿Por qué vos? Detectamos señales de experiencia en este tema a través de conversaciones privadas 🔒`,
    briefWhyGeneric: (channel) => `💡 ¿Por qué vos? Detectamos señales de experiencia en este tema a través de conversaciones y actividad relacionada _(a través del canal #${channel})_`,
    briefCTA: (userId) => `👉🏻 Si tenés disponibilidad, podés sumarte y ayudar al Humander <@${userId}>`,
    wasRecommended: `⭐ _Recomendado por la comunidad como experto en este tema_`,
    briefWasRecommended: `⭐ *Recomendado:* integrantes del equipo lo señalaron como la persona indicada para este tema.`,
    briefFooter: `_⚡ Esta conexión fue generada automáticamente para acelerar la resolución interna de problemas._`,
    unhelpfulButton: "🔁 No era lo que buscaba para este tema",
    unhelpfulAck: (q) => `Gracias, vamos a mejorar los resultados para _${q}_. ¿Sabés quién sería la persona indicada para este tema?`,
    selectExpert: "Seleccioná a alguien...",
    suggestionThanks: (name) => `✅ Anotado. Vamos a tener en cuenta a *${name}* para búsquedas similares.`,
    lowActivityBadge: "🐌 _Baja actividad en Slack_",
    expertiseSignals: (channel) => `🧠 *Señales de expertise:* #${channel}`,
    lowActivityWarning: "⚠️ _Esta persona no parece estar muy activa en Slack. Si no recibís respuesta, considerá contactarla por otro canal (por ejemplo: WhatsApp, email, HuChat)._",
    miniappShortcutTitle: "⚡ *Shortcut detectado*",
    miniappRelatedTo: (miniapp, squad) => `Esto parece estar relacionado con la Mini-App *${miniapp}* (Squad ${squad})`,
    miniappTechnical: (mention) => `⚙️ *Tema técnico* → ${mention} (Engineering Manager)`,
    miniappProduct: (mention) => `🧠 *Tema de producto* → ${mention} (Product Manager)`,
    miniappConnectWith: (name) => `Conectar con ${name}`,
    miniappEMExplanation: (miniapp) => `Engineering Manager de la Mini-App ${miniapp}`,
    miniappPMExplanation: (miniapp) => `Product Manager de la Mini-App ${miniapp}`,
    miniappEMBrief: (miniapp) => `Como *Engineering Manager* de *${miniapp}*, te contactamos porque la consulta parece ser de índole técnica.`,
    miniappPMBrief: (miniapp) => `Como *Product Manager* de *${miniapp}*, te contactamos porque la consulta parece estar relacionada con producto o experiencia.`,
  },
  en: {
    iKnow: (q) => `🤓☝🏻 I'm analyzing knowledge across Hu to identify the people most likely to help with: _${q}_`,
    searching: (q) => `🔍 Searching for experts on _${q}_...`,
    noExperts: (q) => `No clear experts found for *${q}*.`,
    noQuery: "Usage: `/huknows <topic or problem>`",
    error: "Something went wrong while searching for experts.",
    connected: (name) => `🤝 Connected with *${name}*. Chat opened and brief sent.`,
    connect: "Connect",
    available: "Available",
    away: "Away",
    dndUntil: (t) => `DND until ${t}`,
    dnd: "Do Not Disturb",
    topExperts: (q) => `🏆 Best matches: ${q}`,
    topExpertsHeader: "🏆 Best matches for this topic",
    singleExpertHeader: "I know! I suggest you talk to:",
    activeIn: (channel) => `💬 Active in #${channel}`,
    topicLabel: (q) => `📌 Topic: ${q}`,
    helpful: "✅ Yes, very helpful",
    unhelpful: "❌ No, not helpful",
    skipSuggestion: "I don't know, thanks anyway",
    feedbackThanks: (name) => `🧠 Thanks! *${name}* gets credit as an expert on this topic.`,
    feedbackPrompt: (name) => `👆 Was *${name}* helpful?`,
    frequentBadge: (n) => `🔥 Popular search · ${n} ${n === 1 ? "person found" : "people found"} this helpful`,
    tryChannels: "No clear experts found, but these channels might be the right place to ask:",
    noExpertsNoChannels: (q) => `No experts or relevant channels found for *${q}*.`,
    briefGreeting: (name) => `👋🏻 Hey ${name}!`,
    briefIdentified: (q) => `🧠 *HuKnows identified you as one of the best people to help with this topic:* ${q}`,
    briefWhy: (reason) => `💡 Why you? ${reason}`,
    briefWhyChannel: (reason, channel) => `💡 Why you? ${reason} _(through channel #${channel})_`,
    briefWhyPrivate: (reason) => `💡 Why you? ${reason} 🔒`,
    briefWhyPrivateGeneric: `💡 Why you? Your expertise was detected through private conversations 🔒`,
    briefWhyGeneric: (channel) => `💡 Why you? Your expertise was detected through conversations and signals related to this topic _(through channel #${channel})_`,
    briefCTA: (userId) => `👉🏻 If you're available, jump in and help <@${userId}> to unblock this.`,
    wasRecommended: `⭐ _Recommended by the team as an expert on this topic_`,
    briefWasRecommended: `⭐ *Recommended:* team members identified them as the right person for this topic.`,
    briefFooter: `_⚡ This connection was generated automatically to speed up internal problem solving._`,
    unhelpfulButton: "🔁 Not quite what I was looking for",
    unhelpfulAck: (q) => `Thanks, we'll improve results for _${q}_. Do you know who the right person for this topic would be?`,
    selectExpert: "Select someone...",
    suggestionThanks: (name) => `✅ Got it. We'll take *${name}* into account for similar searches.`,
    lowActivityBadge: "🐌 _Low Slack activity_",
    expertiseSignals: (channel) => `🧠 *Expertise signals:* #${channel}`,
    lowActivityWarning: "⚠️ _This person doesn't appear to be very active on Slack. If you don't get a response here, consider reaching out through another channel (e.g.: WhatsApp, Email, HuChat)._",
    miniappShortcutTitle: "⚡ *Shortcut detected*",
    miniappRelatedTo: (miniapp, squad) => `This looks related to the *${miniapp}* Mini-App (Squad ${squad})`,
    miniappTechnical: (mention) => `⚙️ *Technical topic* → ${mention} (Engineering Manager)`,
    miniappProduct: (mention) => `🧠 *Product topic* → ${mention} (Product Manager)`,
    miniappConnectWith: (name) => `Connect with ${name}`,
    miniappEMExplanation: (miniapp) => `Engineering Manager of the ${miniapp} Mini-App`,
    miniappPMExplanation: (miniapp) => `Product Manager of the ${miniapp} Mini-App`,
    miniappEMBrief: (miniapp) => `As *Engineering Manager* of *${miniapp}*, we're reaching out because your query seems technical in nature.`,
    miniappPMBrief: (miniapp) => `As *Product Manager* of *${miniapp}*, we're reaching out because your query seems related to product or user experience.`,
  },
};

function resolveLang(lang) {
  if (STRINGS[lang]) return lang;
  if (lang === "pt") return "es";
  return "en";
}

function t(lang, key, ...args) {
  const str = STRINGS[resolveLang(lang)]?.[key] ?? STRINGS["es"][key];
  return typeof str === "function" ? str(...args) : str;
}

module.exports = { detectLanguage, t };
