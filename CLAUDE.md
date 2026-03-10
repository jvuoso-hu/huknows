You are a senior product-minded software engineer helping improve a hackathon project.

I am building a Slack AI agent called **HuKnows** and I would like you to review the project and suggest improvements to the architecture, code quality, and capabilities.

You can also propose refactors or directly modify the code if it improves clarity, performance, or extensibility.

The goal is NOT overengineering. This is a hackathon POC that should stay simple, but feel like a real product.

---

PROJECT IDEA

HuKnows is a Slack AI agent designed to solve a very common internal problem in growing organizations:

People often don't know **who inside the company knows about a specific topic.**

So they ask in Slack:

"Does anyone know about this?"

This causes friction:

- time lost searching for the right person
- interruptions to the wrong people
- duplicated questions
- slow internal problem solving

HuKnows solves this.

HuKnows = **"The AI that knows who knows."**

---

HOW IT WORKS

A user types:

/huknows <problem or topic>

Example:

/huknows payroll chile

HuKnows then:

1. Searches messages across public Slack channels
2. Detects people who discussed similar topics
3. Ranks the most relevant experts
4. Shows a Top 3 with availability
5. Explains why each expert was selected
6. Allows the user to instantly connect

When the user clicks Connect:

- HuKnows opens a Slack chat
- includes the expert
- sends a short contextual brief

This immediately starts the conversation with the right person.

---

EXAMPLE RESULT

🔎 Top experts for: payroll chile

👤 1. Maria — score 4 — 🟢 Available  
💬 mercado-chile: "Para clientes de Chile siempre reviso..."

👤 2. Juan — score 3 — 🟡 DND  
💬 presupuesto: "El impacto en payroll depende..."

👤 3. Pedro — score 2 — ⚪ Away

Buttons:

Connect #1  
Connect #2  
Connect #3

---

CONNECTION MESSAGE

When connecting:

👋 Hi Maria!

🧠 HuKnows identified you as one of the most relevant people to help with this topic.

📌 Topic: payroll chile

💬 Why you: you recently discussed this in #mercado-chile.

⚡ This connection was generated automatically to speed up internal problem solving.

---

CURRENT IMPLEMENTATION

This is currently a working POC with:

- Node.js
- JavaScript
- Slack Bolt SDK
- Slack API
- Cloudflare Tunnel

Features already implemented:

- Slack slash command `/huknows`
- reading messages from public channels
- naive keyword-based expert ranking
- availability check (DND)
- Slack Block Kit UI
- Connect buttons
- opening Slack conversation
- sending contextual brief

The code currently runs locally.

---

LIMITATIONS

The current ranking system is simple.

It only:

- extracts keywords
- scans recent channel messages
- increments score when keywords match
- returns Top 3 users

This works for a POC but could be improved.

Limitations:

- no semantic understanding
- no weighting for recency
- no weighting for repeated expertise
- no thread awareness
- no contextual explanation
- no caching of Slack calls
- code still mostly in a single file

---

WHAT I WANT FROM YOU

Please review the code in the repository and help improve the project.

Specifically:

1. Suggest a cleaner project structure.
2. Refactor the code if needed.
3. Improve the expert ranking algorithm while keeping it simple.
4. Improve explainability ("why this expert").
5. Improve the Slack UI output.
6. Reduce unnecessary Slack API calls if possible.
7. Suggest performance improvements.
8. Suggest ways to make the demo feel more "AI-powered".
9. Suggest small features that increase perceived intelligence.

Important constraints:

- Keep the project simple.
- Do not overengineer.
- This is a hackathon project.
- Focus on practical improvements.

---

FUTURE IDEAS (DO NOT IMPLEMENT YET)

Possible future upgrades:

- semantic search using embeddings
- knowledge graph of expertise
- trending knowledge topics
- "fastest available expert"
- learning from resolved threads
- integrating documentation sources
- analytics of internal knowledge patterns

You can suggest designs that make these easier later.

---

WHAT I WOULD LIKE YOU TO DO

After reviewing the repo:

1. Explain what you think of the current design.
2. Suggest improvements.
3. If helpful, refactor parts of the code.
4. Show the improved code.

Focus on making the project:

- cleaner
- more readable
- more product-like
- easier to extend

---

REPOSITORY

Please now analyze the repository and suggest improvements.
