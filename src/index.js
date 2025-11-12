// Minimal Node.js app for OpenAI code generation (Codex-style)
import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY in your environment. Create a .env file from .env.example.');
  process.exit(1);
}

// Codex (code-davinci-002) is retired; default to a current code-capable model.
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const client = new OpenAI({ apiKey });

async function generateCode(prompt) {
  // Use the Responses API to get plain text code back.
  const response = await client.responses.create({
    model,
    input: `You are an expert programmer. Respond with JavaScript code only, no commentary. Task: ${prompt}`
  });

  // The SDK provides a convenience helper 'output_text' on the response object.
  // If your SDK version doesn't support it, inspect response.output or response.content.
  const text = response.output_text ?? String(response.output?.[0]?.content?.[0]?.text ?? '');
  return text.trim();
}

async function main() {
  const prompt = process.argv.slice(2).join(' ') || 'Write a function in JavaScript that reverses a string.';
  const code = await generateCode(prompt);

  console.log('\n=== Generated Code ===\n');
  console.log(code);
  console.log('\n======================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
