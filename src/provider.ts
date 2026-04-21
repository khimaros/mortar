import * as vscode from "vscode";
import { Config } from "./config";
import { FimClient } from "./client";
import { LruCache } from "./cache";
import { StatusBar } from "./statusbar";
import { ContextRing } from "./context";
import {
    delay,
    getPrefixLines,
    getSuffixLines,
    isOnlySpaces,
    removeLeadingSpaces,
    removeTrailingNewlines,
    shouldDiscardSuggestion,
    trimSuggestion,
} from "./util";

export class FimProvider implements vscode.InlineCompletionItemProvider {
    private cache: LruCache;
    private inflight = false;
    forceNext = false;

    constructor(
        private cfg: Config,
        private client: FimClient,
        private statusbar: StatusBar,
        private ring: ContextRing,
    ) {
        this.cache = new LruCache(cfg.maxCacheKeys);
    }

    update(cfg: Config): void {
        this.cfg = cfg;
        this.cache = new LruCache(cfg.maxCacheKeys);
    }

    provideInlineCompletionItems = async (
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken,
    ): Promise<vscode.InlineCompletionItem[] | null> => {
        const isAuto = context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic;
        if (isAuto && !this.cfg.auto) return null;

        if (isAuto && this.cfg.debounceMs > 0) {
            await delay(this.cfg.debounceMs);
            if (token.isCancellationRequested) return null;
        }

        while (this.inflight) {
            await delay(30);
            if (token.isCancellationRequested) return null;
        }

        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.slice(0, position.character);
        const lineSuffix = lineText.slice(position.character);
        if (isAuto && lineSuffix.length > this.cfg.maxLineSuffix) return null;

        const prefixLines = getPrefixLines(document, position, this.cfg.nPrefix);
        const suffixLines = getSuffixLines(document, position, this.cfg.nSuffix);
        const inputPrefix = prefixLines.join("\n") + "\n";
        const inputSuffix = lineSuffix + "\n" + suffixLines.join("\n") + "\n";
        const nIndent = lineText.length - lineText.trimStart().length;

        let prompt = linePrefix;
        let spacesToRemove = 0;
        if (isOnlySpaces(prompt)) {
            spacesToRemove = linePrefix.length;
            prompt = "";
        }

        this.inflight = true;
        try {
            let completions: string[] | undefined;
            if (!this.forceNext) {
                completions = this.cache.lookupWithPromptPrefix(inputPrefix, inputSuffix, prompt);
            }
            this.forceNext = false;

            if (!completions) {
                if (token.isCancellationRequested) return null;
                const ac = new AbortController();
                const sub = token.onCancellationRequested(() => ac.abort());
                this.statusbar.showThinking();
                try {
                    const inputExtra = this.ring.snapshot(document.uri.fsPath);
                    const data = await this.client.getCompletion(
                        { inputPrefix, inputSuffix, prompt, nIndent: nIndent || undefined, inputExtra },
                        ac.signal,
                    );
                    if (!data || !data.content) {
                        this.statusbar.showEmpty();
                        return [];
                    }
                    this.statusbar.showDone(data.predictedMs, data.predictedN);
                    completions = [data.content];
                } catch (err: any) {
                    if (err?.name === "AbortError") {
                        this.statusbar.showIdle();
                        return null;
                    }
                    console.error("mortar: completion error", err);
                    const msg = err?.message ?? "error fetching completion";
                    this.statusbar.showError(msg);
                    vscode.window.showInformationMessage(`Mortar: ${msg}`);
                    return [];
                } finally {
                    sub.dispose();
                }
            }

            const accepted: string[] = [];
            for (const c of completions) {
                const lines = c.split(/\r?\n/);
                removeTrailingNewlines(lines);
                if (shouldDiscardSuggestion(lines, document, position, linePrefix, lineSuffix)) continue;
                accepted.push(trimSuggestion(lines, lineSuffix));
            }
            if (!accepted.length) {
                this.statusbar.showEmpty();
                return [];
            }

            this.cache.put(LruCache.hash(inputPrefix, inputSuffix, prompt), accepted);

            if (this.cfg.prefetch && accepted[0]) {
                this.prefetchAfter(prefixLines, linePrefix, lineSuffix, suffixLines, accepted[0]);
            }

            return accepted.map((text) => {
                const item = new vscode.InlineCompletionItem(
                    removeLeadingSpaces(text, spacesToRemove),
                    new vscode.Range(position, position),
                );
                // re-fire the provider after the user accepts so completions chain
                item.command = { command: "editor.action.inlineSuggest.trigger", title: "" };
                return item;
            });
        } finally {
            this.inflight = false;
        }
    };

    // speculatively fetch the completion that would come next if the user accepts
    // `accepted` in full, and stash it in the cache so the re-trigger is instant.
    private prefetchAfter(
        prefixLines: string[],
        linePrefix: string,
        lineSuffix: string,
        suffixLines: string[],
        accepted: string,
    ): void {
        const accLines = accepted.split(/\r?\n/);
        const newPrefixLines = [...prefixLines];
        let newPrompt: string;
        if (accLines.length === 1) {
            newPrompt = linePrefix + accLines[0];
        } else {
            newPrefixLines.push(linePrefix + accLines[0]);
            for (let i = 1; i < accLines.length - 1; i++) newPrefixLines.push(accLines[i]);
            newPrompt = accLines[accLines.length - 1];
        }
        const newInputPrefix = newPrefixLines.join("\n") + "\n";
        const newInputSuffix = lineSuffix + "\n" + suffixLines.join("\n") + "\n";
        const key = LruCache.hash(newInputPrefix, newInputSuffix, newPrompt);
        if (this.cache.get(key)) return;
        const ac = new AbortController();
        this.client.getCompletion(
            { inputPrefix: newInputPrefix, inputSuffix: newInputSuffix, prompt: newPrompt },
            ac.signal,
        ).then((data) => {
            if (!data || !data.content) return;
            this.cache.put(key, [data.content]);
        }).catch(() => { /* best-effort */ });
    }
}
