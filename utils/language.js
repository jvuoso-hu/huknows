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
    noExperts: (q) => `No encontré expertos para *${q}* en los canales públicos.`,
    noQuery: "Usá el comando así: `/huknows <tema o problema>`",
    error: "Ocurrió un error buscando expertos.",
    connected: (name) => `🤝 Conectado con *${name}*. Chat abierto y brief enviado.`,
    connect: "Conectar",
    available: "Disponible",
    away: "Ausente",
    dndUntil: (t) => `No molestar hasta ${t}`,
    dnd: "No molestar",
    topExperts: (q) => `Top expertos para: ${q}`,
    helpful: "✅ Sí, me ayudó",
    feedbackThanks: (name) => `🧠 ¡Gracias! HuKnows anotó a *${name}* como experto útil en este tema.`,
    feedbackPrompt: (name) => `¿Te ayudó *${name}*?`,
    frequentBadge: (n) => `🔥 Búsqueda frecuente · ${n} ${n === 1 ? "persona encontró" : "personas encontraron"} esto útil`,
  },
  en: {
    searching: (q) => `🔍 Searching for experts on _${q}_...`,
    noExperts: (q) => `No clear experts found for *${q}* in public channels.`,
    noQuery: "Usage: `/huknows <topic or problem>`",
    error: "Something went wrong while searching for experts.",
    connected: (name) => `🤝 Connected with *${name}*. Chat opened and brief sent.`,
    connect: "Connect",
    available: "Available",
    away: "Away",
    dndUntil: (t) => `DND until ${t}`,
    dnd: "Do Not Disturb",
    topExperts: (q) => `Top experts for: ${q}`,
    helpful: "✅ Yes, they helped",
    feedbackThanks: (name) => `🧠 Thanks! HuKnows noted *${name}* as a helpful expert on this topic.`,
    feedbackPrompt: (name) => `Did *${name}* help you?`,
    frequentBadge: (n) => `🔥 Popular search · ${n} ${n === 1 ? "person found" : "people found"} this helpful`,
  },
};

function t(lang, key, ...args) {
  const str = STRINGS[lang]?.[key] ?? STRINGS["es"][key];
  return typeof str === "function" ? str(...args) : str;
}

module.exports = { detectLanguage, t };
