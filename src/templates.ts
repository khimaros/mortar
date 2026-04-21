// per-model fim prompt templates for openai mode. keyed by a substring matched
// case-insensitively against the model id. used only when the user hasn't
// overridden `mortar.openaiPromptTemplate` from its default.

export const DEFAULT_TEMPLATE = "<|fim_prefix|>{prefix}{prompt}<|fim_suffix|>{suffix}<|fim_middle|>";

interface TemplateRule {
    match: RegExp;
    template: string;
}

const RULES: TemplateRule[] = [
    // deepseek-coder: <|fim▁begin|>{prefix}<|fim▁hole|>{suffix}<|fim▁end|>
    { match: /deepseek/i, template: "<|fim▁begin|>{prefix}{prompt}<|fim▁hole|>{suffix}<|fim▁end|>" },
    // codellama / starcoder style: <PRE> {prefix} <SUF>{suffix} <MID>
    { match: /codellama|starcoder|santacoder/i, template: "<PRE> {prefix}{prompt} <SUF>{suffix} <MID>" },
    // qwen / yi / default fim tokens.
    { match: /qwen|yi-coder/i, template: DEFAULT_TEMPLATE },
];

export function pickTemplate(model: string, configured: string): string {
    if (configured && configured !== DEFAULT_TEMPLATE) return configured;
    for (const r of RULES) if (r.match.test(model)) return r.template;
    return DEFAULT_TEMPLATE;
}
