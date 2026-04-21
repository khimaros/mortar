# design

## overview

mortar is a minimal vs code extension that provides fill-in-the-middle
code autocomplete backed by a remote inference server. it is a stripped-down
port of the fim path from [llama.vscode](https://github.com/ggml-org/llama.vscode)
and [llama.vim](https://github.com/ggml-org/llama.vim), with a second code path
for openai-compatible `/v1/completions` so it works against llama.cpp, vllm,
tabbyapi, llama-swap, etc.

## modules (src/)

- `config.ts` — reads `mortar.*` settings. normalizes the endpoint by stripping
  trailing `/v1` or `/infill` so the client can append whichever path it needs.
- `client.ts` — single class `FimClient` that speaks either `/infill` (native
  llama.cpp) or `/v1/completions` (openai-compat). in `auto` mode it probes
  `/infill` once per session with `n_predict:0` and caches the decision.
- `cache.ts` — small lru keyed by `sha1(prefix|suffix|prompt)`. exposes
  `lookupWithPromptPrefix` so typing forward reuses a cached completion by
  trimming the matching head off its cached content.
- `util.ts` — local context gathering (`getPrefixLines` / `getSuffixLines`),
  plus the discard-repeat and suggestion-trim helpers ported from
  `reference/llama.vscode/src/completion.ts`.
- `provider.ts` — vscode `InlineCompletionItemProvider`. debounces automatic
  triggers, serializes inflight requests, honors the cancellation token (wired
  to an `AbortController`), and filters/caches results.
- `extension.ts` — wires the provider, registers commands, and re-reads config
  on change.
- `statusbar.ts` — right-aligned `StatusBarItem` reflecting state
  (idle / disabled / thinking / done-with-timings / error). clicking it opens
  the mortar quick-pick menu. hidden when `mortar.statusBar` is false.
- `models.ts` — `listModels(endpoint, apiKey)` hits `GET {endpoint}/v1/models`,
  returning the sorted list of model ids for the setup quick-pick.
- `templates.ts` — per-model fim prompt templates for openai mode
  (deepseek, codellama/starcoder, qwen). used only when the user hasn't
  overridden `mortar.openaiPromptTemplate` from its default.
- `context.ts` — `ContextRing`, a small ring buffer of chunks captured from
  `onDidChangeTextDocument`. the most-recent chunks (minus the active file)
  ride along as `input_extra` on each completion. ported loosely from
  llama.vim's `s:pick_chunk`.

## request shapes

### native /infill (preferred)

```
POST {endpoint}/infill
{
  input_prefix, input_suffix, input_extra: [], prompt,
  n_predict, top_k: 40, top_p: 0.99, stream: false,
  samplers: ["top_k","top_p","infill"],
  cache_prompt: true,
  t_max_prompt_ms, t_max_predict_ms,
  n_indent?, model?
}
```

response: `{ content, timings: { predicted_n, predicted_ms }, model, ... }`.

### openai fallback

```
POST {endpoint}/v1/completions
{
  model, prompt: template({prefix,suffix,prompt}),
  max_tokens, temperature: 0.1, top_p: 0.99, stream: false,
  stop: ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>", "<|file_sep|>", "<|repo_name|>"]
}
```

response: `{ choices: [{ text }], usage, model }`.

default template is qwen-style: `<|fim_prefix|>{prefix}{prompt}<|fim_suffix|>{suffix}<|fim_middle|>`.
override via `mortar.openaiPromptTemplate` for other families (codellama,
deepseek).

## context gathering

- `input_prefix` = up to `nPrefix` lines above the cursor, joined with `\n`, plus trailing newline.
- `prompt` = text on the cursor line from column 0 to cursor. if it is only
  whitespace, treat as empty and remember `spacesToRemove` so we can strip the
  same amount of leading whitespace from the suggestion.
- `input_suffix` = remainder of the cursor line + up to `nSuffix` lines below.
- `n_indent` = leading-whitespace count of the cursor line (native mode only).
- `input_extra` = up to `ringNChunks` recent chunks from other files, most-recent
  first. only used by native `/infill` (the openai surface has no equivalent).

## control flow

1. `provideInlineCompletionItems` fires (automatic or manual).
2. if automatic and `auto=false`, return null. if automatic and `maxLineSuffix`
   exceeded, return null.
3. debounce on automatic triggers. wait for any inflight request to finish.
4. try the cache with prompt-prefix lookup.
5. on miss, call `FimClient.getCompletion` with an `AbortController` bound to
   the vs code cancellation token.
6. split, trim, run `shouldDiscardSuggestion`, `trimSuggestion`.
7. cache and return as `InlineCompletionItem`s.
8. if `mortar.prefetch` is on, simulate the user accepting the suggestion,
   compute the new prefix/suffix/prompt, and fire a background `getCompletion`
   that populates the cache so the post-accept re-trigger hits instantly.

## commands

- `mortar.triggerCompletion` — force a fresh (non-cached) suggestion.
- `mortar.toggleAuto` — flip `mortar.auto`.
- `mortar.setup` / `mortar.configureEndpoint` / `mortar.selectModel` — onboarding.
- `mortar.showMenu` — quick-pick of all of the above (also bound to the status bar click).
- `mortar.openSettings` — jump to the extension's settings pane.
- `mortar.acceptLine` / `mortar.acceptWord` — thin wrappers over
  `editor.action.inlineSuggest.acceptNextLine` / `acceptNextWord` for keybindings.

## reference

- `reference/llama.vscode/` — upstream vs code extension (full feature set).
- `reference/llama.vim/` — upstream vim plugin (closest in spirit to this extension).
