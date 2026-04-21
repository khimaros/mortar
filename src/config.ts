import * as vscode from "vscode";

export type Mode = "auto" | "infill" | "openai";

export interface Config {
    endpoint: string;
    model: string;
    apiKey: string;
    mode: Mode;
    openaiPromptTemplate: string;
    openaiStopStrings: string[];
    nPrefix: number;
    nSuffix: number;
    nPredict: number;
    tMaxPromptMs: number;
    tMaxPredictMs: number;
    debounceMs: number;
    maxLineSuffix: number;
    auto: boolean;
    maxCacheKeys: number;
    statusBar: boolean;
    statusBarTimings: boolean;
    ringNChunks: number;
    prefetch: boolean;
}

// strip trailing /v1 or /infill so the client can append whichever path it needs
export function normalizeEndpoint(raw: string): string {
    let e = raw.trim().replace(/\/+$/, "");
    e = e.replace(/\/(v1|infill)$/, "");
    return e;
}

export function readConfig(): Config {
    const c = vscode.workspace.getConfiguration("mortar");
    return {
        endpoint: normalizeEndpoint(c.get<string>("endpoint", "")),
        model: c.get<string>("model", ""),
        apiKey: c.get<string>("apiKey", ""),
        mode: c.get<Mode>("mode", "auto"),
        openaiPromptTemplate: c.get<string>("openaiPromptTemplate", ""),
        openaiStopStrings: c.get<string[]>("openaiStopStrings", []),
        nPrefix: c.get<number>("nPrefix", 256),
        nSuffix: c.get<number>("nSuffix", 64),
        nPredict: c.get<number>("nPredict", 128),
        tMaxPromptMs: c.get<number>("tMaxPromptMs", 500),
        tMaxPredictMs: c.get<number>("tMaxPredictMs", 1000),
        debounceMs: c.get<number>("debounceMs", 150),
        maxLineSuffix: c.get<number>("maxLineSuffix", 8),
        auto: c.get<boolean>("auto", true),
        maxCacheKeys: c.get<number>("maxCacheKeys", 250),
        statusBar: c.get<boolean>("statusBar", true),
        statusBarTimings: c.get<boolean>("statusBarTimings", false),
        ringNChunks: c.get<number>("ringNChunks", 16),
        prefetch: c.get<boolean>("prefetch", false),
    };
}
