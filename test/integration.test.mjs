import test from "node:test";
import assert from "node:assert/strict";
import { FimClient } from "../out/client.js";

const endpoint = process.env.MORTAR_TEST_ENDPOINT;
const model = process.env.MORTAR_TEST_MODEL ?? "";

// shared tiny FIM scenario: insert a function body. prefix ends with "def
// fibonacci(n):\n    ", suffix begins with "\n    return result\n".
const fimInput = {
    inputPrefix: "def fibonacci(n):\n    ",
    inputSuffix: "\n    return result\n",
    prompt: "",
};

function makeConfig(overrides = {}) {
    return {
        endpoint,
        model,
        apiKey: "",
        mode: "auto",
        openaiPromptTemplate: "<|fim_prefix|>{prefix}{prompt}<|fim_suffix|>{suffix}<|fim_middle|>",
        openaiStopStrings: ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>", "<|file_sep|>", "<|repo_name|>"],
        nPrefix: 256,
        nSuffix: 64,
        nPredict: 32,
        tMaxPromptMs: 5000,
        tMaxPredictMs: 5000,
        debounceMs: 0,
        maxLineSuffix: 8,
        auto: true,
        maxCacheKeys: 16,
        ...overrides,
    };
}

if (!endpoint) {
    test("integration tests skipped (set MORTAR_TEST_ENDPOINT to enable)", { skip: true }, () => {});
} else {
    test(`native /infill returns non-empty content (${endpoint})`, async () => {
        const client = new FimClient(makeConfig({ mode: "infill" }));
        const ac = new AbortController();
        const res = await client.getCompletion(fimInput, ac.signal);
        assert.ok(res, "response should be defined");
        assert.ok(res.content && res.content.length > 0, `expected non-empty content, got ${JSON.stringify(res)}`);
    });

    test(`openai /v1/completions returns non-empty content`, async () => {
        const client = new FimClient(makeConfig({ mode: "openai" }));
        const ac = new AbortController();
        const res = await client.getCompletion(fimInput, ac.signal);
        assert.ok(res, "response should be defined");
        assert.ok(res.content && res.content.length > 0, `expected non-empty content, got ${JSON.stringify(res)}`);
    });

    test(`auto mode resolves to either infill or openai and succeeds`, async () => {
        const client = new FimClient(makeConfig({ mode: "auto" }));
        const ac = new AbortController();
        const res = await client.getCompletion(fimInput, ac.signal);
        assert.ok(res, "response should be defined");
        assert.ok(res.content && res.content.length > 0);
    });

    test(`cancellation via AbortSignal rejects in-flight request`, async () => {
        const client = new FimClient(makeConfig({ mode: "infill", nPredict: 256 }));
        const ac = new AbortController();
        const p = client.getCompletion(fimInput, ac.signal);
        ac.abort();
        await assert.rejects(p);
    });
}
