# 🔍 Cómo está armado HuKnows

Guía de explicación del producto, tech y no tech.

---

## 🎯 Qué es HuKnows (en una frase)

Es un **asistente dentro de Slack** que, cuando alguien escribe algo como _“¿quién sabe de X?”_, **lee conversaciones recientes**, **elige hasta 3 personas** que parecen saber del tema y **arma la pantalla** para que puedas **conectar** con ellas en un chat.

**HuKnows = _“La IA que sabe quién sabe.”_**

---

## 📦 Las “cajitas” (piezas del sistema)

Imaginá bloques conectados así:

```
     ┌─────────────────────┐     ┌─────────────────────┐
     │  📱 Slack           │     │  📊 Google Sheets    │
     │  (mensajes, canales,│     │  (roles, mini-apps, │
     │   presencia, DND)   │     │   EM/PM)            │
     └──────────┬──────────┘     └──────────┬──────────┘
                │  proveedores de info      │
                └────────────┬─────────────┘
                             │ ↑↓
                ┌────────────▼────────────┐
                │  ⚡ HuKnows (Railway)   │
                └────┬──────────┬────┬────┘
                     │ ↑↓       │ ↑↓ │ ↑↓
        ┌────────────▼──┐  ┌────▼───▼────┐  ┌────────────▼────────┐
        │  🤖 IA Claude  │  │  🔴 Redis   │  │  📋 Notion          │
        │  (Anthropic)  │  │  (Railway)  │  │  (dashboards,       │
        └───────────────┘  │  persistencia│  │   analytics)        │
                           └─────────────┘  └─────────────────────┘
```

| Cajita                 | Qué es                                                                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **📱 Slack**           | Donde trabaja la gente: canales, mensajes, estados (“en reunión”, “almuerzo”), botones. **Proveedor de info** principal (conversaciones y presencia).                                                                       |
| **📊 Google Sheets**   | Va **en paralelo a Slack** como proveedor de info: sirve sobre todo para **roles del equipo** y **dueños de mini-apps** (EM/PM). HuKnows lo lee para enriquecer el ranking.                                                 |
| **⚡ HuKnows**         | El “cerebro” del producto: un programa (Node.js) que Slack llama cuando alguien usa el comando y cuando tocan botones. **Vive en Railway** (servidor en la nube).                                                           |
| **🤖 IA (Claude)**     | No “navega” Slack: **interpreta texto** que HuKnows le manda (mensajes, estados, listas) y **devuelve decisiones** (quién es experto, por qué, disponibilidad en palabras).                                                 |
| **🔴 Redis (Railway)** | Base de datos en memoria en Railway. **Persistencia**: búsquedas, feedback negativo/positivo, conexiones recientes, temas resueltos. Así los datos sobreviven reinicios.                                                    |
| **📋 Notion**          | Cuando se actualiza la data **después de cada búsqueda** (y al abrir la Home), HuKnows **exporta un resumen** a una página de Notion: **dashboards de analytics**, temas trending, expertos top, conexiones recientes, etc. |

---

## 🔄 Flujo: del comando al resultado

**1️⃣ El usuario escribe**  
`/huknows payroll Chile` (o el tema que sea).

**2️⃣ Slack avisa a HuKnows**  
Slack le dice al servidor en **Railway**: “fulanito pidió esto”.

**3️⃣ Respuesta inmediata**  
HuKnows contesta al usuario algo tipo _“Ya estoy buscando…”_ (solo lo ve quien preguntó).

**4️⃣ HuKnows junta datos de dos lados (en paralelo)**  
- **Slack**: lista de canales, **mensajes recientes** (y respuestas en hilos), perfiles y presencia.  
- **Google Sheets**: **roles del equipo** y tabla **mini-app → EM / PM** (contexto de negocio).  
Sheets sirve sobre todo para saber **quién hace qué** (roles); Slack aporta las conversaciones.

**5️⃣ Primera intervención de IA (ranking)**  
No manda _todos_ los mensajes: arma un **muestrario** (hasta ~200 fragmentos) y se lo pasa a **Claude** con instrucciones claras. La IA:

- elige **hasta 3 expertos**;
- explica **por qué** cada uno;
- redacta un **mensaje corto personalizado** para cuando los conecten;
- puede sugerir **canales** relacionados;
- si la consulta encaja con una **mini-app** de la hoja, indica **a quién hablar** (técnico vs producto).

También puede **bajar prioridad** a alguien que otros marcaron como “no sirvió” para ese tema, o **subir** a alguien que la organización sugirió como experto.

**6️⃣ Segunda intervención de IA (disponibilidad)**  
Para los 3 elegidos, HuKnows pide a Slack: presencia, “no molestar”, texto del estado. Otra llamada a **Claude** traduce eso a algo legible: _“Disponible”_, _“En reunión hasta las 15”_, etc.

**7️⃣ Armado de la pantalla en Slack**  
Un módulo arma **bloques visuales** (títulos, textos, botones **Conectar**). Si hubo match de mini-app, muestra **conectar con EM o PM**.

**8️⃣ Si tocás “Conectar”**  
HuKnows abre un **chat grupal** (vos + el experto) y manda un **brief** con contexto. Después pide **feedback** (útil / no útil). Eso se **persiste en Redis** y, si fue útil, puede actualizar Sheets. Cuando alguien abre la **Home** del bot, HuKnows arma la vista en Slack y **exporta el mismo resumen a Notion** (dashboards de analytics de usuarios, temas trending, expertos más conectados, etc.).

---

## 🧩 Dónde está “la implementación”

| Idea                    | Dónde vive                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| **Orquestación**        | `app.js`: atiende el comando, botones y la “casa” de la app en Slack.          |
| **Búsqueda + datos**    | `services/ranking.js`: Slack + hilos + hojas + preparación para la IA.         |
| **IA expertos**         | `services/aiRanking.js`: Claude elige expertos y redacciones.                  |
| **IA estado**           | `services/aiStatus.js`: Claude interpreta si alguien está libre o ocupado.     |
| **Pantalla Slack**      | `slack/blocks.js` + `slack/userInfo.js`.                                       |
| **Idioma**              | `utils/language.js`: textos y detección ES/EN.                                 |
| **Aprendizaje liviano** | `utils/feedback.js`: conteos y sugerencias humanas; **persiste en Redis**.     |
| **Redis**               | `services/redis.js`: persistencia en Railway (búsquedas, feedback, conexiones). |
| **Notion**              | `services/notion.js`: export del resumen de Home → dashboards/analytics.       |
| **Hojas**               | `utils/sheets.js`: roles, mini-apps (proveedor de info en paralelo a Slack).   |
| **Caché**               | `utils/cache.js`: menos llamadas repetidas a Slack.                           |
| **Home del bot**        | `slack/home.js`: estadísticas; IA para agrupar temas; dispara export a Notion. |

---

## ✅ Resumen para cerrar la charla

- **📱 Slack** es el lugar donde vive la experiencia; **📊 Sheets** va en paralelo como proveedor de info (sobre todo **roles**).
- **⚡ HuKnows** corre en **Railway** y es el servicio que conecta Slack, Sheets, la IA, Redis y Notion.
- **🤖 La IA** no “navega Slack sola”: recibe **resúmenes y reglas** y **devuelve** nombres, explicaciones y textos.
- **🔴 Redis** (también en Railway) **persiste** búsquedas, feedback y conexiones para que no se pierdan al reiniciar.
- **📋 Notion** recibe la data actualizada **post búsqueda** y cuando se abre la Home: **dashboards de analytics** de usuarios, temas trending, expertos más conectados.
- Todo está pensado como **POC de hackathon**: simple pero con varias capas que **se sienten producto** (explicaciones, conexión directa, feedback, persistencia, analytics en Notion).
