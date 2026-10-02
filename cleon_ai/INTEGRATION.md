# CleonAI integration contract (Odoo 17)

## Architecture

Depend on cleon_ai. Business modules extend cleon.ai.gateway via normal Odoo model
inheritance; keep business tools and record access in those modules. The core owns
provider dispatch, the assistant shell and interaction logging. It depends only on
base and web. It does not execute arbitrary model-generated code or actions.

## Provider boundary

complete_text(prompt) returns provider text or raises ValidationError. Both this method
and ask_assistant(question, screen_context) use _dispatch_provider_text, the common
server-side extension point. A custom provider addon can override it and delegate
unhandled cases to super. Do not change consumer code when switching hosted/local providers.

System parameters (administrator-owned):

- cleon_ai.provider: none, gemini, openai, local, or ollama.
- cleon_ai.live_calls_enabled: True explicitly enables network calls.
- cleon_ai.model: installed/provider model name.
- cleon_ai.openai_base_url and cleon_ai.openai_api_key: hosted compatible endpoint.
- cleon_ai.local_base_url and cleon_ai.local_api_key: local OpenAI-compatible server;
  base URL includes /v1, adapter appends /chat/completions.
- cleon_ai.ollama_base_url: Ollama server; adapter uses /api/chat with stream=false.
- cleon_ai.gemini_api_key: Gemini adapter credential.
- cleon_ai.transcription_model: separate speech model where supported.

Environment fallbacks: GEMINI_API_KEY, OPENAI_API_KEY, LOCAL_LLM_API_KEY.
Never commit credentials. Restrict parameter editing to trusted administrators.
Local means the configured server location, not an automatic privacy guarantee.
Core RPC entry points require internal users; portal access needs a separate,
explicitly permission-checked adapter rather than removing that boundary.

## Business integration hooks

- _get_screen_ai_context(screen, screen_context): return authorized UI context or None.
- _collect_ai_tools(profile=None, screen_context=None): merge super() tools with your
  authorized catalog. Use unique names; mark unfinished tools unavailable/unimplemented.
- _dispatch_tool_execution(tool_name, params, screen_context=None): recheck permissions
  at execution, dispatch only known tools, and delegate unknown names to super().

Unknown screens fail closed. No screen means no business tools. A screen name is
client input, not authorization. Consumers must enforce record rules and company scope.
Tool confirmation currently covers preparation/navigation, NOT authorization to mutate
records. Future write tools require a server-bound confirmation contract.
Model text is untrusted: validate structured output and selected record IDs; never eval it.

## Capabilities and limitations

Hosted and local text adapters are implemented. Audio transcription is implemented for
Gemini and compatible OpenAI/local endpoints, but NOT the Ollama adapter. Local models
and endpoint compatibility must be tested on the actual deployment; mocked dispatch tests
only prove routing. No models are downloaded by this addon.

Interaction history stores question, answer and screen context. Avoid sending unnecessary
personal data. Retention currently defaults to 90 days and can consume a Leave company
retention setting; a generic independent company setting remains future work.
Provider error bodies are withheld to avoid echoing sensitive prompts or credentials.

Before exposing this broadly: configure request throttling/quotas and transport controls,
verify provider response-shape failures, test each target local server, review retention
and data consent, and test business tools under least-privilege users. These are release
checks, not features claimed as complete by this audit.
