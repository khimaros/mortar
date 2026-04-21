# roadmap

## next

## later

- [ ] telemetry/log of prefetch hit rate.

## done

- [x] scaffold extension: package.json, tsconfig, eslint, makefile, src skeleton.
- [x] config surface: endpoint, model, api key, mode, tuning knobs.
- [x] fim client with native /infill + openai /v1/completions fallback and auto-probe.
- [x] inline completion provider with debounce, cancel, lru cache, discard-repeat logic.
- [x] commands: trigger completion, toggle auto.
- [x] re-trigger inline suggest after accept so completions chain without backspacing.
- [x] rename project from vscode-fimoai to mortar (package, config keys, command ids, docs).
- [x] svg + png logo wired as extension icon; vsix packaging folded into default `make`.
- [x] gplv3 license.
- [x] install deps and verify `make precommit` passes.
- [x] unit tests for lru cache (direct hit, eviction, recency, prefix-extension lookup).
- [x] integration test harness that hits a live server and exercises both modes + cancellation.
- [x] manual end-to-end smoke test against a live llama.cpp server with a fim-capable coder model.
- [x] status bar indicator (idle / thinking / last predicted_ms)
- [x] onboarding flow + `mortar.statusBar` toggle.
- [x] document the `MORTAR_TEST_ENDPOINT` / `MORTAR_TEST_MODEL` env vars in the readme.
- [x] ring-buffer extra context from recently-edited buffers (port from llama.vim s:pick_chunk).
- [x] accept-next-line and accept-next-word commands (wrap vs code built-ins).
- [x] per-model default prompt templates (codellama, deepseek) for openai mode.
- [x] prefetch future completions (see llama.vscode cacheFutureSuggestion).
