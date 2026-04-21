import * as vscode from "vscode";

interface LastStats {
    predictedMs?: number;
    predictedN?: number;
    at: number;
}

type State =
    | { kind: "idle" }
    | { kind: "disabled" }
    | { kind: "thinking"; since: number }
    | { kind: "done" }
    | { kind: "empty" }
    | { kind: "error"; msg: string };

export class StatusBar {
    private item: vscode.StatusBarItem;
    private enabled = true;
    private showTimings = false;
    private last: LastStats | undefined;
    private state: State = { kind: "idle" };
    private tick: NodeJS.Timeout | undefined;

    constructor() {
        this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.item.command = "mortar.showMenu";
        this.showIdle();
        this.item.show();
    }

    setEnabled(on: boolean): void {
        this.enabled = on;
        if (on) this.item.show();
        else this.item.hide();
    }

    setShowTimings(on: boolean): void {
        this.showTimings = on;
        this.render();
    }

    showIdle(): void {
        this.setState({ kind: "idle" });
    }

    showDisabled(): void {
        this.setState({ kind: "disabled" });
    }

    showThinking(): void {
        this.setState({ kind: "thinking", since: Date.now() });
    }

    showDone(predictedMs?: number, predictedN?: number): void {
        this.last = { predictedMs, predictedN, at: Date.now() };
        this.setState({ kind: "done" });
    }

    // completion request succeeded but server returned no suggestion (or it was filtered).
    showEmpty(): void {
        this.setState({ kind: "empty" });
        setTimeout(() => {
            if (this.state.kind === "empty") this.showIdle();
        }, 2500);
    }

    showError(msg: string): void {
        this.setState({ kind: "error", msg });
        setTimeout(() => {
            if (this.state.kind === "error") this.showIdle();
        }, 5000);
    }

    private setState(s: State): void {
        this.state = s;
        this.stopTicker();
        if (s.kind === "thinking") this.startTicker();
        this.render();
    }

    // keep the ticker alive only when the thinking label is actually shown on the status bar.
    private startTicker(): void {
        if (!this.showTimings) return;
        this.tick = setInterval(() => this.render(), 500);
    }

    private stopTicker(): void {
        if (this.tick) { clearInterval(this.tick); this.tick = undefined; }
    }

    private render(): void {
        const { icon, label, state } = this.visuals();
        // clean mode: icon + "mortar" only. verbose mode: append label + timings.
        let text = `${icon} mortar`;
        if (this.showTimings) {
            if (label) text = `${icon} mortar ${label}`;
            else {
                const detail = this.formatStats();
                if (detail) text = `${icon} mortar ${detail}`;
            }
        }
        this.item.text = text;
        this.item.tooltip = this.buildTooltip(state);
    }

    private visuals(): { icon: string; label: string; state: string } {
        switch (this.state.kind) {
            case "idle": return { icon: "$(sparkle)", label: "", state: "idle" };
            case "disabled": return { icon: "$(circle-slash)", label: "off", state: "automatic completion disabled" };
            case "thinking": {
                const elapsed = ((Date.now() - this.state.since) / 1000).toFixed(1);
                return { icon: "$(sync~spin)", label: `thinking ${elapsed}s`, state: "waiting for server" };
            }
            case "done": return { icon: "$(sparkle)", label: "", state: "last completion" };
            case "empty": return { icon: "$(dash)", label: "no suggestion", state: "server returned no suggestion" };
            case "error": return { icon: "$(warning)", label: "error", state: `error: ${this.state.msg}` };
        }
    }

    private formatStats(): string {
        if (!this.last) return "";
        const parts: string[] = [];
        if (this.last.predictedMs !== undefined) parts.push(`${Math.round(this.last.predictedMs)}ms`);
        if (this.last.predictedN !== undefined) parts.push(`${this.last.predictedN}t`);
        if (this.last.predictedMs !== undefined && this.last.predictedN) {
            const tps = (this.last.predictedN / this.last.predictedMs) * 1000;
            parts.push(`${tps.toFixed(1)}t/s`);
        }
        return parts.join(" ");
    }

    private buildTooltip(state: string): vscode.MarkdownString {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**mortar** — ${state}\n\n`);
        if (this.last) {
            const { predictedMs, predictedN } = this.last;
            md.appendMarkdown(`last completion:\n`);
            if (predictedMs !== undefined) md.appendMarkdown(`- time: ${Math.round(predictedMs)} ms\n`);
            if (predictedN !== undefined) md.appendMarkdown(`- tokens: ${predictedN}\n`);
            if (predictedMs !== undefined && predictedN) {
                const tps = (predictedN / predictedMs) * 1000;
                md.appendMarkdown(`- throughput: ${tps.toFixed(1)} t/s\n`);
            }
            md.appendMarkdown(`\n`);
        }
        md.appendMarkdown(`_click for actions_`);
        return md;
    }

    dispose(): void {
        this.stopTicker();
        this.item.dispose();
    }
}
