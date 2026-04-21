import * as vscode from "vscode";

// ring buffer of chunks from recently-edited buffers, passed to /infill as
// input_extra. ported loosely from llama.vim's s:pick_chunk.

export interface Chunk {
    filename: string;
    text: string;
}

const CHUNK_LINES = 16;

export class ContextRing {
    private chunks: Chunk[] = [];
    constructor(private capacity: number) {}

    setCapacity(n: number): void {
        this.capacity = Math.max(0, n);
        while (this.chunks.length > this.capacity) this.chunks.shift();
    }

    // record a chunk around the edited range in `doc`. skips non-file schemes.
    recordEdit(doc: vscode.TextDocument, range: vscode.Range): void {
        if (this.capacity <= 0) return;
        if (doc.uri.scheme !== "file") return;
        const start = Math.max(0, range.start.line - CHUNK_LINES / 2);
        const end = Math.min(doc.lineCount, start + CHUNK_LINES);
        const lines: string[] = [];
        for (let i = start; i < end; i++) lines.push(doc.lineAt(i).text);
        const text = lines.join("\n");
        if (!text.trim()) return;
        const filename = doc.uri.fsPath;
        // dedupe: drop any existing chunk with identical text, then append as most-recent.
        this.chunks = this.chunks.filter((c) => c.text !== text);
        this.chunks.push({ filename, text });
        while (this.chunks.length > this.capacity) this.chunks.shift();
    }

    // most-recent first, excluding the currently-active file (it's already the prefix/suffix).
    snapshot(excludeFilename?: string): Chunk[] {
        const out: Chunk[] = [];
        for (let i = this.chunks.length - 1; i >= 0; i--) {
            const c = this.chunks[i];
            if (excludeFilename && c.filename === excludeFilename) continue;
            out.push(c);
        }
        return out;
    }
}
