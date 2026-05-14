---
name: 9router-chat
description: Chat / code generation via 9Router using OpenAI /v1/chat/completions or Anthropic /v1/messages format with streaming + auto-fallback combos. Use when the user wants to ask an LLM, generate code, summarize text, or run prompts through 9Router.
version: 1.0.0
metadata:
  hermes:
    tags: [gateway, chat, 9router, code-generation]
    category: integrations
---

# 9Router — Chat

Requires `NINEROUTER_URL` (and `NINEROUTER_KEY` if auth enabled). See bundled skill `9router` for setup.

## Endpoints

- `POST $NINEROUTER_URL/v1/chat/completions` — OpenAI format
- `POST $NINEROUTER_URL/v1/messages` — Anthropic format

## Discover

```bash
curl $NINEROUTER_URL/v1/models | jq '.data[].id'
# Per-model metadata (contextWindow, params)
curl "$NINEROUTER_URL/v1/models/info?id=openai/gpt-4o"
```

Combos (e.g. `vip`, `mycodex`) auto-fallback through multiple providers.

## OpenAI format

```bash
curl -X POST $NINEROUTER_URL/v1/chat/completions \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/gpt-5","messages":[{"role":"user","content":"Hi"}],"stream":false}'
```

JS (OpenAI SDK):

```js
import OpenAI from "openai";
const client = new OpenAI({ baseURL: `${process.env.NINEROUTER_URL}/v1`, apiKey: process.env.NINEROUTER_KEY });
const res = await client.chat.completions.create({
  model: "openai/gpt-5",
  messages: [{ role: "user", content: "Hi" }],
  stream: true,
});
for await (const chunk of res) process.stdout.write(chunk.choices[0]?.delta?.content || "");
```

## Anthropic format

```bash
curl -X POST $NINEROUTER_URL/v1/messages \
  -H "Authorization: Bearer $NINEROUTER_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{"model":"cc/claude-opus-4-7","max_tokens":1024,"messages":[{"role":"user","content":"Hi"}]}'
```

## Response shape

OpenAI (`/v1/chat/completions`):
```json
{ "id": "chatcmpl-...", "object": "chat.completion", "model": "openai/gpt-5",
  "choices": [{ "index": 0, "message": { "role": "assistant", "content": "Hello!" }, "finish_reason": "stop" }],
  "usage": { "prompt_tokens": 8, "completion_tokens": 2, "total_tokens": 10 } }
```

Streaming (`stream:true`) emits SSE: `data: {choices:[{delta:{content:"..."}}]}\n\n` ... `data: [DONE]\n\n`.

Anthropic (`/v1/messages`):
```json
{ "id": "msg_...", "type": "message", "role": "assistant", "model": "cc/claude-opus-4-7",
  "content": [{ "type": "text", "text": "Hello!" }],
  "stop_reason": "end_turn", "usage": { "input_tokens": 8, "output_tokens": 2 } }
```

## Agent Web integration

This project already routes 9Router through the `9router` provider with OpenAI-compatible `streamText` (`/v1/chat/completions`). Set:

- Provider: **9Router**
- Base URL: `https://rfb2lzd.9router.com/v1` (or your `NINEROUTER_URL/v1`)
- Model: any `id` from `/v1/models` (e.g. `ag/claude-sonnet-4-6`, combo names)

For Anthropic-native models on 9Router, the gateway may still accept OpenAI format on `/v1/chat/completions`; use `/v1/messages` only when explicitly required.
