import { Config, Mode } from "./config";
import { pickTemplate } from "./templates";

export interface FimRequest {
    inputPrefix: string;
    inputSuffix: string;
    prompt: string;
    nIndent?: number;
    inputExtra?: { text: string; filename: string }[];
}

export interface FimResponse {
    content: string;
    model?: string;
    predictedN?: number;
    predictedMs?: number;
}

// picks /infill vs /v1/completions, lazily probing once for "auto".
export class FimClient {
    private resolvedMode: Exclude<Mode, "auto"> | undefined;
    constructor(private cfg: Config) {}

    reset(cfg: Config): void {
        this.cfg = cfg;
        this.resolvedMode = undefined;
    }

    async getCompletion(req: FimRequest, signal: AbortSignal): Promise<FimResponse | undefined> {
        const mode = await this.resolveMode(signal);
        if (mode === "infill") return this.callInfill(req, signal);
        return this.callOpenai(req, signal);
    }

    private async resolveMode(signal: AbortSignal): Promise<Exclude<Mode, "auto">> {
        if (this.cfg.mode !== "auto") return this.cfg.mode;
        if (this.resolvedMode) return this.resolvedMode;
        try {
            const res = await this.post("/infill", {
                input_prefix: "",
                input_suffix: "",
                input_extra: [],
                prompt: "",
                n_predict: 0,
                samplers: [],
                cache_prompt: true,
                t_max_prompt_ms: 1,
                ...(this.cfg.model.trim() && { model: this.cfg.model }),
            }, signal);
            this.resolvedMode = res.ok ? "infill" : "openai";
        } catch {
            this.resolvedMode = "openai";
        }
        return this.resolvedMode;
    }

    private async callInfill(req: FimRequest, signal: AbortSignal): Promise<FimResponse | undefined> {
        const body: any = {
            input_prefix: req.inputPrefix,
            input_suffix: req.inputSuffix,
            input_extra: req.inputExtra ?? [],
            prompt: req.prompt,
            n_predict: this.cfg.nPredict,
            top_k: 40,
            top_p: 0.99,
            stream: false,
            samplers: ["top_k", "top_p", "infill"],
            cache_prompt: true,
            t_max_prompt_ms: this.cfg.tMaxPromptMs,
            t_max_predict_ms: this.cfg.tMaxPredictMs,
        };
        if (req.nIndent !== undefined) body.n_indent = req.nIndent;
        if (this.cfg.model.trim()) body.model = this.cfg.model;
        const started = Date.now();
        const res = await this.post("/infill", body, signal);
        if (!res.ok) return undefined;
        const data = await res.json() as any;
        return {
            content: data.content ?? "",
            model: data.model,
            predictedN: data.timings?.predicted_n,
            predictedMs: data.timings?.predicted_ms ?? (Date.now() - started),
        };
    }

    private async callOpenai(req: FimRequest, signal: AbortSignal): Promise<FimResponse | undefined> {
        const template = pickTemplate(this.cfg.model, this.cfg.openaiPromptTemplate);
        const prompt = template
            .replace("{prefix}", req.inputPrefix)
            .replace("{prompt}", req.prompt)
            .replace("{suffix}", req.inputSuffix);
        const body: any = {
            model: this.cfg.model,
            prompt,
            max_tokens: this.cfg.nPredict,
            temperature: 0.1,
            top_p: 0.99,
            stream: false,
            stop: this.cfg.openaiStopStrings,
        };
        const started = Date.now();
        const res = await this.post("/v1/completions", body, signal);
        if (!res.ok) return undefined;
        const data = await res.json() as any;
        const text = data.choices?.[0]?.text ?? "";
        return {
            content: text,
            model: data.model,
            predictedN: data.usage?.completion_tokens,
            predictedMs: Date.now() - started,
        };
    }

    private post(path: string, body: any, signal: AbortSignal): Promise<Response> {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (this.cfg.apiKey.trim()) headers["Authorization"] = `Bearer ${this.cfg.apiKey}`;
        return fetch(this.cfg.endpoint + path, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal,
        });
    }
}
