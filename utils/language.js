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
    topExperts: (q) => `🏆 Top expertos: ${q}`,
    helpful: "✅ Sí, sumarle puntos",
    feedbackThanks: (name) => `🧠 ¡Gracias! Le sumamos puntos a *${name}* como experto en este tema.`,
    feedbackPrompt: (name) => `👆 ¿Te fue útil *${name}*? Tocá para reconocerlo como experto y mejorar el algoritmo.`,
    frequentBadge: (n) => `🔥 Búsqueda frecuente · ${n} ${n === 1 ? "persona encontró" : "personas encontraron"} esto útil`,
    tryChannels: "No encontré expertos claros, pero estos canales podrían ser el lugar indicado para preguntar:",
    noExpertsNoChannels: (q) => `No encontré expertos ni canales relevantes para *${q}*.`,
    briefGreeting: (name) => `👋 Hola ${name}!`,
    briefIdentified: `🔎 *HuKnows te identificó como una de las personas más relevantes para ayudar con este tema.*`,
    briefTopic: (q) => `📌 *Tema:* ${q}`,
    briefWhy: (reason) => `💬 *Por qué vos:* ${reason}`,
    briefWhyPrivate: `💬 *Por qué vos:* Identificamos que tenés conocimiento en este tema a través de conversaciones privadas 🔒`,
    briefFooter: `_⚡ Esta conexión fue generada automáticamente para acelerar la resolución interna de problemas._`,
  },
  en: {
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
    topExperts: (q) => `🏆 Top experts: ${q}`,
    helpful: "✅ Yes, give them credit",
    feedbackThanks: (name) => `🧠 Thanks! *${name}* gets credit as an expert on this topic.`,
    feedbackPrompt: (name) => `👆 Was *${name}* helpful? Tap to recognize them and improve the algorithm.`,
    frequentBadge: (n) => `🔥 Popular search · ${n} ${n === 1 ? "person found" : "people found"} this helpful`,
    tryChannels: "No clear experts found, but these channels might be the right place to ask:",
    noExpertsNoChannels: (q) => `No experts or relevant channels found for *${q}*.`,
    briefGreeting: (name) => `👋 Hi ${name}!`,
    briefIdentified: `🔎 *HuKnows identified you as one of the most relevant people to help with this topic.*`,
    briefTopic: (q) => `📌 *Topic:* ${q}`,
    briefWhy: (reason) => `💬 *Why you:* ${reason}`,
    briefWhyPrivate: `💬 *Why you:* We identified your expertise on this topic through private conversations 🔒`,
    briefFooter: `_⚡ This connection was generated automatically to speed up internal problem solving._`,
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
