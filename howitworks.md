# 🔍 Cómo está armado HuKnows (explicación no técnica)

Guía para explicar el proyecto a alguien que no es técnico: cajitas, conexiones e intervención de la IA.

---

## 🎯 Qué es HuKnows (en una frase)

Es un **asistente dentro de Slack** que, cuando alguien escribe algo como *“¿quién sabe de X?”*, **lee conversaciones recientes**, **elige hasta 3 personas** que parecen saber del tema y **arma la pantalla** para que puedas **conectar** con ellas en un chat.

**HuKnows = *“La IA que sabe quién sabe.”***

---

## 📦 Las “cajitas” (piezas del sistema)

Imaginá bloques conectados así:

```
┌─────────────────────────────────┐
│  📱 Slack (usuarios y canales)  │
└───────────────┬─────────────────┘
                │ ↑↓
┌───────────────▼─────────────────┐
│  ⚡ HuKnows (programa en Railway)│
└───────┬───────────────────┬─────┘
        │ ↑↓                │ ↑↓
┌───────▼───────┐   ┌───────▼───────┐
│  🤖 IA Claude │   │ 📊 Google     │
│  (Anthropic)  │   │    Sheets     │
└───────────────┘   └───────────────┘
```

| Cajita | Qué es |
|--------|--------|
| **📱 Slack** | Donde trabaja la gente: canales, mensajes, estados (“en reunión”, “almuerzo”), botones. |
| **⚡ HuKnows** | El “cerebro” del producto: un programa (Node.js) que Slack llama cuando alguien usa el comando y cuando tocan botones. **Vive en Railway** (servidor en la nube). |
| **🤖 IA (Claude)** | No “navega” Slack: **interpreta texto** que HuKnows le manda (mensajes, estados, listas) y **devuelve decisiones** (quién es experto, por qué, disponibilidad en palabras). |
| **📊 Google Sheets** | Una hoja con **roles del equipo** y **dueños de mini-apps** para enriquecer el contexto; otra hoja puede **sumar puntos** cuando alguien marca que la conexión fue útil. |
| **💾 Memoria (en Railway)** | Guarda cosas **solo mientras el servidor está prendido**: búsquedas recientes, feedback negativo/positivo, caché de mensajes para no pegarle tanto a Slack. |

---

## 🔄 Flujo: del comando al resultado

**1️⃣ El usuario escribe**  
`/huknows payroll Chile` (o el tema que sea).

**2️⃣ Slack avisa a HuKnows**  
Slack le dice al servidor en **Railway**: “fulanito pidió esto”.

**3️⃣ Respuesta inmediata**  
HuKnows contesta al usuario algo tipo *“Ya estoy buscando…”* (solo lo ve quien preguntó).

**4️⃣ HuKnows pide datos a Slack**  
- Lista de canales (públicos y privados a los que el bot tiene acceso).  
- **Mensajes recientes** de cada canal (y en algunos casos **respuestas en hilos**).  
- Info de perfiles (títulos) de quienes aparecieron en esos mensajes.

**5️⃣ HuKnows suma contexto “de negocio”**  
Lee **Google Sheets**: roles/áreas por nombre y tabla de **mini-app → EM / PM**.

**6️⃣ Primera intervención de IA (ranking)**  
No manda *todos* los mensajes: arma un **muestrario** (hasta ~200 fragmentos) y se lo pasa a **Claude** con instrucciones claras. La IA:

- elige **hasta 3 expertos**;  
- explica **por qué** cada uno;  
- redacta un **mensaje corto personalizado** para cuando los conecten;  
- puede sugerir **canales** relacionados;  
- si la consulta encaja con una **mini-app** de la hoja, indica **a quién hablar** (técnico vs producto).

También puede **bajar prioridad** a alguien que otros marcaron como “no sirvió” para ese tema, o **subir** a alguien que la organización sugirió como experto.

**7️⃣ Segunda intervención de IA (disponibilidad)**  
Para los 3 elegidos, HuKnows pide a Slack: presencia, “no molestar”, texto del estado. Otra llamada a **Claude** traduce eso a algo legible: *“Disponible”*, *“En reunión hasta las 15”*, etc.

**8️⃣ Armado de la pantalla en Slack**  
Un módulo arma **bloques visuales** (títulos, textos, botones **Conectar**). Si hubo match de mini-app, muestra **conectar con EM o PM**.

**9️⃣ Si tocás “Conectar”**  
HuKnows abre un **chat grupal** (vos + el experto) y manda un **brief** con contexto. Después pide **feedback** (útil / no útil). Eso alimenta la memoria y, si fue útil, puede **actualizar la hoja** de puntos del experto.

---

## 🧩 Dónde está “la implementación”

| Idea | Dónde vive |
|------|------------|
| **Orquestación** | `app.js`: atiende el comando, botones y la “casa” de la app en Slack. |
| **Búsqueda + datos** | `services/ranking.js`: Slack + hilos + hojas + preparación para la IA. |
| **IA expertos** | `services/aiRanking.js`: Claude elige expertos y redacciones. |
| **IA estado** | `services/aiStatus.js`: Claude interpreta si alguien está libre o ocupado. |
| **Pantalla Slack** | `slack/blocks.js` + `slack/userInfo.js`. |
| **Idioma** | `utils/language.js`: textos y detección ES/EN. |
| **Aprendizaje liviano** | `utils/feedback.js`: conteos y sugerencias humanas. |
| **Hojas** | `utils/sheets.js`: roles, mini-apps, puntos. |
| **Caché** | `utils/cache.js`: menos llamadas repetidas a Slack. |
| **Home del bot** | `slack/home.js`: estadísticas; otra vez IA para **agrupar temas** de búsqueda. |

---

## ✅ Resumen para cerrar la charla

- **📱 Slack** es el lugar donde vive la experiencia.  
- **⚡ HuKnows** corre en **Railway** y es el servicio que conecta Slack con datos internos y con la IA.  
- **🤖 La IA** no “navega Slack sola”: recibe **resúmenes y reglas** y **devuelve** nombres, explicaciones y textos.  
- **📊 Sheets** aporta **organigrama/mini-apps** y **métricas simples** de ayuda útil.  
- Todo está pensado como **POC de hackathon**: simple, con memoria que se resetea al redeploy, pero con varias capas que **se sienten producto** (explicaciones, conexión directa, feedback).
