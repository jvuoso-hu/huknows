const SPANISH_CHARS = /[áéíóúüñ¿¡]/i;
const SPANISH_WORDS = new Set([
  "que", "con", "para", "como", "pero", "hay", "tiene", "desde",
  "quiero", "necesito", "sobre", "cual", "donde", "cuando", "quien",
  "alguien", "sabe", "conoce", "ayuda", "busco", "tema",
]);
const ENGLISH_WORDS = new Set([
  "what", "who", "how", "where", "when", "about", "with", "from",
  "need", "want", "find", "help", "know", "someone", "topic", "looking",
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
  },
};

function t(lang, key, ...args) {
  const str = STRINGS[lang]?.[key] ?? STRINGS["es"][key];
  return typeof str === "function" ? str(...args) : str;
}

module.exports = { detectLanguage, t };
