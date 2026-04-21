import * as vscode from "vscode";

export const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getPrefixLines(document: vscode.TextDocument, position: vscode.Position, n: number): string[] {
    const start = Math.max(0, position.line - n);
    const lines: string[] = [];
    for (let i = start; i < position.line; i++) lines.push(document.lineAt(i).text);
    return lines;
}

export function getSuffixLines(document: vscode.TextDocument, position: vscode.Position, n: number): string[] {
    const end = Math.min(document.lineCount, position.line + 1 + n);
    const lines: string[] = [];
    for (let i = position.line + 1; i < end; i++) lines.push(document.lineAt(i).text);
    return lines;
}

export function removeTrailingNewlines(lines: string[]): void {
    while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
}

export function isOnlySpaces(s: string): boolean {
    return /^[ \t]*$/.test(s);
}

// Drop suggestions that just repeat text already present around the cursor.
// Ported from reference/llama.vscode/src/completion.ts.
export function shouldDiscardSuggestion(
    suggestionLines: string[],
    document: vscode.TextDocument,
    position: vscode.Position,
    linePrefix: string,
    lineSuffix: string,
): boolean {
    if (suggestionLines.length === 0) return true;
    if (suggestionLines.length === 1 && suggestionLines[0].trim() === "") return true;
    if (position.line === document.lineCount - 1) return false;

    if (
        suggestionLines.length > 1 &&
        (suggestionLines[0].trim() === "" || suggestionLines[0].trim() === lineSuffix.trim()) &&
        suggestionLines.slice(1).every((v, i) => v === document.lineAt(position.line + 1 + i).text)
    ) return true;

    if (suggestionLines.length === 1 && suggestionLines[0] === lineSuffix) return true;

    let firstNonEmpty = position.line + 1;
    while (firstNonEmpty < document.lineCount && document.lineAt(firstNonEmpty).text.trim() === "") firstNonEmpty++;
    if (firstNonEmpty >= document.lineCount) return false;

    if (linePrefix + suggestionLines[0] === document.lineAt(firstNonEmpty).text) {
        if (suggestionLines.length === 1) return true;
        if (
            suggestionLines.length === 2 &&
            suggestionLines[1] === document.lineAt(firstNonEmpty + 1).text.slice(0, suggestionLines[1].length)
        ) return true;
        if (
            suggestionLines.length > 2 &&
            suggestionLines.slice(1).every((v, i) => v === document.lineAt(firstNonEmpty + 1 + i).text)
        ) return true;
    }
    return false;
}

// If the suggestion already covers what's on the rest of the line, trim accordingly.
export function trimSuggestion(suggestionLines: string[], lineSuffix: string): string {
    if (lineSuffix.trim() !== "") {
        if (suggestionLines[0].endsWith(lineSuffix)) return suggestionLines[0].slice(0, -lineSuffix.length);
        if (suggestionLines.length > 1) return suggestionLines[0];
    }
    return suggestionLines.join("\n");
}

export function removeLeadingSpaces(s: string, n: number): string {
    let i = 0;
    while (i < s.length && i < n && (s[i] === " " || s[i] === "\t")) i++;
    return s.slice(i);
}
