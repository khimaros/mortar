import test from "node:test";
import assert from "node:assert/strict";
import { LruCache } from "../out/cache.js";

test("lru: put and get roundtrip", () => {
    const c = new LruCache(4);
    c.put("a", ["x"]);
    assert.deepEqual(c.get("a"), ["x"]);
});

test("lru: eviction is fifo once full", () => {
    const c = new LruCache(2);
    c.put("a", ["1"]);
    c.put("b", ["2"]);
    c.put("c", ["3"]);
    assert.equal(c.get("a"), undefined);
    assert.deepEqual(c.get("b"), ["2"]);
    assert.deepEqual(c.get("c"), ["3"]);
});

test("lru: get refreshes recency", () => {
    const c = new LruCache(2);
    c.put("a", ["1"]);
    c.put("b", ["2"]);
    c.get("a");
    c.put("c", ["3"]);
    assert.deepEqual(c.get("a"), ["1"]);
    assert.equal(c.get("b"), undefined);
});

test("lookupWithPromptPrefix: direct hit", () => {
    const c = new LruCache(8);
    const key = LruCache.hash("pre", "suf", "foo");
    c.put(key, ["bar"]);
    assert.deepEqual(c.lookupWithPromptPrefix("pre", "suf", "foo"), ["bar"]);
});

test("lookupWithPromptPrefix: prefix-extension trims matching head", () => {
    // cache has completion "return 42" keyed by prompt="re".
    // now user typed more so prompt is "ret". the cached completion starts
    // with "t" (the delta), so we should get back "urn 42".
    const c = new LruCache(8);
    const key = LruCache.hash("pre", "suf", "re");
    c.put(key, ["turn 42"]);
    const hit = c.lookupWithPromptPrefix("pre", "suf", "ret");
    assert.deepEqual(hit, ["urn 42"]);
});

test("lookupWithPromptPrefix: miss when cached completion does not continue prompt", () => {
    const c = new LruCache(8);
    c.put(LruCache.hash("pre", "suf", "re"), ["wrong"]);
    assert.equal(c.lookupWithPromptPrefix("pre", "suf", "ret"), undefined);
});
