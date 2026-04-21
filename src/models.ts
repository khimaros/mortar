// fetch the list of model ids from an openai-compatible /v1/models endpoint.
// works against llama.cpp server, llama-swap, vllm, tabbyapi, ollama's openai surface, etc.

export async function listModels(endpoint: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
    const headers: Record<string, string> = {};
    if (apiKey.trim()) headers["Authorization"] = `Bearer ${apiKey}`;
    const res = await fetch(`${endpoint}/v1/models`, { headers, signal });
    if (!res.ok) throw new Error(`GET /v1/models → ${res.status} ${res.statusText}`);
    const data = await res.json() as any;
    const arr = Array.isArray(data.data) ? data.data : [];
    const ids = arr.map((m: any) => String(m.id ?? "")).filter((s: string) => s.length > 0);
    ids.sort((a: string, b: string) => a.localeCompare(b));
    return ids;
}
