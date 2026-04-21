# mortar

minimal fill-in-the-middle autocomplete for vs code, backed by a remote
llama.cpp or openai-compatible server. no local server, no chat, no agents —
just ghost-text code suggestions while you type.

the middle that holds your code together.

## configure

easiest path: click the `$(sparkle) mortar` status bar item and pick **Run setup**.
this prompts for the endpoint and then fetches the model list from the server.

or set two things in vs code settings directly:

- `mortar.endpoint` — base url, e.g. `http://localhost:7860`
- `mortar.model` — model name, e.g. `qwen3-coder-30b-a3b-instruct:Q8_0`

optional:

- `mortar.apiKey` — bearer token.
- `mortar.mode` — `auto` (default, probes /infill then falls back), `infill`, `openai`.
- `mortar.openaiPromptTemplate` — fim template used only in openai mode.
  default is qwen-style `<|fim_prefix|>{prefix}{prompt}<|fim_suffix|>{suffix}<|fim_middle|>`.
- `mortar.statusBar` — show the status bar indicator (default true).
- `mortar.ringNChunks` — max chunks from recently-edited buffers to pass as extra context (default 16, 0 disables).
- `mortar.prefetch` — speculatively fetch the next completion after each accept (default false).
- `mortar.statusBarTimings` — show completion timings inline in the status bar text (default false; timings always available in the tooltip).

## build

```
make deps
make compile
```

run the extension via `F5` in vs code (launches the extension host).

## commands

- `Mortar: Trigger Completion` — force a fresh suggestion at the cursor.
- `Mortar: Toggle Automatic Completion` — enable/disable automatic triggers.
- `Mortar: Run Setup` — endpoint + model selection.
- `Mortar: Configure Endpoint` — just the endpoint.
- `Mortar: Select Model` — fetch `/v1/models` and pick one.
- `Mortar: Show Menu` — quick-pick of the above (also bound to the status bar click).
- `Mortar: Open Settings` — jump to the extension's settings pane.
- `Mortar: Accept Next Line of Completion` / `Mortar: Accept Next Word of Completion` — partial-accept wrappers for keybindings.

## tests

```
make test           # unit tests only
```

integration tests are skipped unless you point them at a live server:

- `MORTAR_TEST_ENDPOINT` — base url, e.g. `http://localhost:7860` (required).
- `MORTAR_TEST_MODEL` — model name the server should load for the run (optional if the server only has one model).

```
MORTAR_TEST_ENDPOINT=http://localhost:7860 \
MORTAR_TEST_MODEL=qwen3-coder-30b-a3b-instruct:Q8_0 \
  make test
```

## protocols

mortar speaks two wire protocols:

1. **native llama.cpp `/infill`** — preferred. the server applies the right
   fim tokens for the loaded model.
2. **openai `/v1/completions`** — fallback. the extension wraps the prompt in
   a fim template client-side and uses stop strings.

see `DESIGN.md` for the exact request shapes.

## reference implementations

- llama.vscode
- llama.vim
