# codex-project (Minimal Node.js setup)

This is a **minimal Node.js project** to generate code via the OpenAI API in a **Codex-style workflow**.
> ⚠️ Note: OpenAI's original *Codex* models are retired. This template defaults to a current code-capable model (`gpt-4o-mini`). You can change the model via `OPENAI_MODEL`.

## Folder Structure
```
codex-project/
├─ src/
│  └─ index.js
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```

## Setup

1) **Install Node 18+**  
2) Copy `.env.example` to `.env` and set your key:
```bash
cp .env.example .env
# edit .env and paste your OpenAI key
```
3) Install dependencies:
```bash
npm install
```
4) Run the script (pass your coding task as an argument or it will use the default):
```bash
npm start -- "Write a function in JavaScript that reverses a string."
```

## Change the Model
In `.env` set:
```
OPENAI_MODEL=gpt-4o-mini
```
You can switch to other current code-capable models you have access to.

## Git: init & push
```bash
git init
git add .
git commit -m "Initial commit: minimal OpenAI code generator"
git branch -M main
git remote add origin https://github.com/<your-username>/codex-project.git
git push -u origin main
```

## Notes
- Do **not** commit `.env`. Your API keys must remain secret.
- The sample uses the **Responses API** to request plain JavaScript code.
- Adjust the `input` instruction in `src/index.js` for different languages or formatting (e.g., Python-only).
