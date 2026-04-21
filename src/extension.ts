import * as vscode from "vscode";
import { readConfig, normalizeEndpoint } from "./config";
import { FimClient } from "./client";
import { FimProvider } from "./provider";
import { StatusBar } from "./statusbar";
import { listModels } from "./models";
import { ContextRing } from "./context";

export function activate(context: vscode.ExtensionContext) {
    let cfg = readConfig();
    const client = new FimClient(cfg);
    const statusbar = new StatusBar();
    const ring = new ContextRing(cfg.ringNChunks);
    const provider = new FimProvider(cfg, client, statusbar, ring);
    context.subscriptions.push(statusbar);

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e) => {
            if (!e.contentChanges.length) return;
            const last = e.contentChanges[e.contentChanges.length - 1];
            ring.recordEdit(e.document, last.range);
        }),
    );

    const refreshStatus = () => {
        statusbar.setEnabled(cfg.statusBar);
        statusbar.setShowTimings(cfg.statusBarTimings);
        if (!cfg.auto) statusbar.showDisabled();
        else statusbar.showIdle();
    };
    refreshStatus();

    context.subscriptions.push(
        vscode.languages.registerInlineCompletionItemProvider({ pattern: "**" }, provider),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("mortar.triggerCompletion", async () => {
            provider.forceNext = true;
            await vscode.commands.executeCommand("editor.action.inlineSuggest.trigger");
        }),
        vscode.commands.registerCommand("mortar.toggleAuto", async () => {
            const target = !cfg.auto;
            await vscode.workspace.getConfiguration("mortar").update("auto", target, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Mortar: automatic completion ${target ? "enabled" : "disabled"}`);
        }),
        vscode.commands.registerCommand("mortar.configureEndpoint", () => configureEndpoint()),
        vscode.commands.registerCommand("mortar.selectModel", () => selectModel()),
        vscode.commands.registerCommand("mortar.setup", () => runSetup()),
        vscode.commands.registerCommand("mortar.showMenu", () => showMenu()),
        vscode.commands.registerCommand("mortar.openSettings", () =>
            vscode.commands.executeCommand("workbench.action.openSettings", "@ext:khimaros.mortar"),
        ),
        // partial-accept wrappers around vs code built-ins so users can bind keys under mortar.*
        vscode.commands.registerCommand("mortar.acceptLine", () =>
            vscode.commands.executeCommand("editor.action.inlineSuggest.acceptNextLine"),
        ),
        vscode.commands.registerCommand("mortar.acceptWord", () =>
            vscode.commands.executeCommand("editor.action.inlineSuggest.acceptNextWord"),
        ),
    );

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (!e.affectsConfiguration("mortar")) return;
            cfg = readConfig();
            client.reset(cfg);
            provider.update(cfg);
            ring.setCapacity(cfg.ringNChunks);
            refreshStatus();
        }),
    );

    // onboarding: if no model is configured, offer setup once on activate.
    if (!cfg.model.trim()) {
        setTimeout(async () => {
            const pick = await vscode.window.showInformationMessage(
                "Mortar: no model configured. Run setup to pick one?",
                "Run setup",
                "Open settings",
                "Dismiss",
            );
            if (pick === "Run setup") runSetup();
            else if (pick === "Open settings") vscode.commands.executeCommand("mortar.openSettings");
        }, 800);
    }
}

async function configureEndpoint(): Promise<string | undefined> {
    const current = vscode.workspace.getConfiguration("mortar").get<string>("endpoint", "");
    const value = await vscode.window.showInputBox({
        title: "Mortar: server endpoint",
        prompt: "base url of your llama.cpp / openai-compatible server",
        value: current,
        placeHolder: "http://localhost:7860",
        ignoreFocusOut: true,
    });
    if (value === undefined) return undefined;
    const normalized = normalizeEndpoint(value);
    await vscode.workspace.getConfiguration("mortar").update("endpoint", normalized, vscode.ConfigurationTarget.Global);
    return normalized;
}

async function selectModel(): Promise<string | undefined> {
    const c = vscode.workspace.getConfiguration("mortar");
    const endpoint = normalizeEndpoint(c.get<string>("endpoint", ""));
    const apiKey = c.get<string>("apiKey", "");
    if (!endpoint) {
        vscode.window.showWarningMessage("Mortar: set an endpoint first.");
        return undefined;
    }
    let ids: string[];
    try {
        ids = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Mortar: fetching models from ${endpoint}` },
            () => listModels(endpoint, apiKey),
        );
    } catch (err: any) {
        vscode.window.showErrorMessage(`Mortar: could not list models — ${err?.message ?? err}`);
        return undefined;
    }
    if (!ids.length) {
        vscode.window.showWarningMessage("Mortar: server returned no models.");
        return undefined;
    }
    const current = c.get<string>("model", "");
    const items: vscode.QuickPickItem[] = ids.map((id) => ({
        label: id,
        description: id === current ? "(current)" : undefined,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: "Mortar: select model",
        placeHolder: current || "type to filter",
        ignoreFocusOut: true,
    });
    if (!picked) return undefined;
    await c.update("model", picked.label, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(`Mortar: model set to ${picked.label}`);
    return picked.label;
}

async function runSetup(): Promise<void> {
    const endpoint = await configureEndpoint();
    if (!endpoint) return;
    await selectModel();
}

async function showMenu(): Promise<void> {
    const c = vscode.workspace.getConfiguration("mortar");
    const endpoint = c.get<string>("endpoint", "");
    const model = c.get<string>("model", "");
    const auto = c.get<boolean>("auto", true);
    const items: (vscode.QuickPickItem & { id: string })[] = [
        { id: "setup", label: "$(rocket) Run setup", description: "endpoint + model selection" },
        { id: "endpoint", label: "$(link) Configure endpoint", description: endpoint || "(unset)" },
        { id: "model", label: "$(symbol-enum) Select model", description: model || "(unset)" },
        { id: "auto", label: `$(${auto ? "pass" : "circle-slash"}) ${auto ? "Disable" : "Enable"} automatic completion` },
        { id: "trigger", label: "$(sparkle) Trigger completion now" },
        { id: "settings", label: "$(gear) Open settings" },
    ];
    const picked = await vscode.window.showQuickPick(items, {
        title: "Mortar",
        placeHolder: model ? `${model} @ ${endpoint}` : "not configured",
    });
    if (!picked) return;
    switch (picked.id) {
        case "setup": return void runSetup();
        case "endpoint": return void configureEndpoint();
        case "model": return void selectModel();
        case "auto": return void vscode.commands.executeCommand("mortar.toggleAuto");
        case "trigger": return void vscode.commands.executeCommand("mortar.triggerCompletion");
        case "settings": return void vscode.commands.executeCommand("mortar.openSettings");
    }
}

export function deactivate() {}
