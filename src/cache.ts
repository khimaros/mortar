import * as crypto from "crypto";

// lru of completion lists keyed by hash(prefix|suffix|prompt). the prefix-extension
// lookup lets typing forward still hit cache without a new server round-trip.
export class LruCache {
    private map = new Map<string, string[]>();
    constructor(private max: number) {}

    static hash(prefix: string, suffix: string, prompt: string): string {
        return crypto.createHash("sha1").update(prefix + "|" + suffix + "|" + prompt).digest("hex");
    }

    get(key: string): string[] | undefined {
        const v = this.map.get(key);
        if (v) {
            this.map.delete(key);
            this.map.set(key, v);
        }
        return v;
    }

    put(key: string, value: string[]): void {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        while (this.map.size > this.max) {
            const oldest = this.map.keys().next().value;
            if (oldest === undefined) break;
            this.map.delete(oldest);
        }
    }

    // walk back through shorter prompts; if a cached completion starts with the
    // bit of prompt we trimmed, return the remaining tail.
    lookupWithPromptPrefix(prefix: string, suffix: string, prompt: string): string[] | undefined {
        const direct = this.get(LruCache.hash(prefix, suffix, prompt));
        if (direct) return direct;
        for (let i = prompt.length - 1; i >= 0; i--) {
            const shorter = prompt.slice(0, i);
            const trimmed = prompt.slice(i);
            const cached = this.get(LruCache.hash(prefix, suffix, shorter));
            if (!cached) continue;
            const tails: string[] = [];
            for (const c of cached) {
                if (c.startsWith(trimmed)) tails.push(c.slice(trimmed.length));
            }
            if (tails.length) return tails;
        }
        return undefined;
    }
}
