# requirements

## product

- provide fill-in-the-middle (FIM) code autocomplete in vs code as ghost-text inline suggestions.
- operate purely against a remote inference server; never spawn a local server.
- require only two pieces of config from the user: `endpoint` and `model`.
- support the native llama.cpp `/infill` endpoint as the primary protocol.
- fall back automatically to openai-compatible `/v1/completions` with a fim prompt template when `/infill` is not available.
- allow the protocol to be forced via `mortar.mode` (`auto` | `infill` | `openai`).
- send an optional bearer token if `mortar.apiKey` is set.
- accept a trailing `/v1` or `/infill` on the endpoint url without breaking routing.

## quality

- completions must not repeat text that is already present around the cursor.
- never regress on the requirements above in any release.
- debounced automatic completions; cancellable via vs code cancellation tokens.
- lru cache for completions so that typing forward reuses prior responses.

## non-goals (for now)

- chat, instruct-edit, agent, tool-calling, embeddings.
- auto-spawning a local llama-server.
- ring-buffer extra context across buffers.
- i18n, webviews, status-bar inference stats.
