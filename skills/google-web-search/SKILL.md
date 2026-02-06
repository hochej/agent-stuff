---
name: google-web-search
description: Enables grounded question answering by automatically executing the Google Search tool within Gemini models. Use when the required information is recent (post knowledge cutoff) or requires verifiable citation.
---

# Google Web Search

## Overview

This skill provides the capability to perform real-time web searches via the
Gemini API's `google_search` grounding tool. It is designed to fetch the most
current information available on the web to provide grounded, citable answers to
user queries.

**Key Features:**

- Real-time web search via Gemini API
- Grounded responses with verifiable citations
- Configurable model selection
- Simple Python API

## Usage

This skill exposes the Gemini API's `google_search` tool. It should be used when
the user asks for **real-time information**, **recent events**, or requests
**verifiable citations**.

### Execution Context

The core logic is in `scripts/example.py`. This skill uses `uv` for dependency
management and execution.

It requires the following environment variables:

- **GEMINI_API_KEY** (required): Your Gemini API key. Ensure this is set in your
  environment (e.g., via `~/.bashrc` or `~/.secrets`).
- **GEMINI_MODEL** (optional): Model to use (default: `gemini-2.5-flash-lite`)

### Setup API Key

You can set the API key by exporting it in your shell or by sourcing it from a
secrets file:

```bash
# Direct export
export GEMINI_API_KEY="your-api-key"

# Or source from ~/.secrets if available
source ~/.secrets
```

### CLI Usage (Recommended for Agents)

The skill includes a dedicated script for performing searches. This is the
preferred way for agents to interact with the skill.

**Requirement:** `GEMINI_API_KEY` must be set in the environment.

```bash
# General search
uv run --with "google-genai>=1.5.0" --with "pydantic-settings" skills/google-web-search/scripts/example.py "Your search query here"

# Example: Get current news
uv run --with "google-genai>=1.5.0" --with "pydantic-settings" skills/google-web-search/scripts/example.py "Latest news on AI agents"
```

### Python Tool Implementation Pattern

When integrating this skill into a larger workflow, you can use `uv` to manage
the environment.

Example Python invocation structure:

```python
# Assuming dependencies are installed in the environment
from scripts.example import get_grounded_response

# Basic usage (uses default model):
prompt = "What is the latest market trend?"
response_text = get_grounded_response(prompt)
print(response_text)
```

### Troubleshooting

If the script fails:

1. **Missing API Key**: Ensure `GEMINI_API_KEY` is set in the execution
   environment.
2. **Library Missing**: Verify that the `google-genai` library is available
   (e.g., using `uv run --with "google-genai>=1.5.0" ...`).
3. **API Limits**: Check the API usage limits on the Google AI Studio dashboard.
4. **Invalid Model**: If you set `GEMINI_MODEL`, ensure it's a valid Gemini
   model name.
5. **Model Not Supporting Grounding**: Some models may not support the
   `google_search` tool. Use flash or pro variants.
