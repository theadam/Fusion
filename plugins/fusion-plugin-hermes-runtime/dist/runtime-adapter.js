/**
 * Hermes Runtime Adapter — drives the local `hermes` CLI as a subprocess.
 *
 * Each call to `promptWithFallback` invokes `hermes chat -q ... -Q --source tool`
 * and captures the resulting `session_id:` line. Subsequent calls on the same
 * session pass `--resume <id>` to continue the conversation.
 */
import { invokeHermesCli, resolveCliSettings } from "./cli-spawn.js";
function buildRuntimeContextSection(options) {
    const skillNames = Array.isArray(options.skills) ? options.skills.filter((value) => typeof value === "string" && value.trim().length > 0) : [];
    const skillSelection = options.skillSelection;
    const selectionSkillNames = Array.isArray(skillSelection?.requestedSkillNames)
        ? skillSelection.requestedSkillNames.filter((value) => typeof value === "string" && value.trim().length > 0)
        : [];
    const mergedSkills = skillNames.length > 0 ? skillNames : selectionSkillNames;
    const lines = [
        "Fusion runtime context:",
        `- Tool mode: ${options.tools ?? "coding"}`,
    ];
    if (mergedSkills.length > 0) {
        lines.push(`- Requested skills: ${mergedSkills.join(", ")}`);
    }
    lines.push("- If fn_* tools are available in your runtime, use them directly for coordination/memory/task actions.");
    return lines.join("\n");
}
export class HermesRuntimeAdapter {
    id = "hermes";
    name = "Hermes Runtime";
    settings;
    constructor(settings) {
        this.settings = resolveCliSettings(settings);
    }
    async createSession(options) {
        const session = {
            model: undefined,
            systemPrompt: options.systemPrompt,
            messages: [],
            apiKey: undefined,
            thinkingLevel: undefined,
            sessionId: "",
            lastModelDescription: this.describeFromSettings(),
            callbacks: {
                onText: options.onText,
                onThinking: options.onThinking,
                onToolStart: options.onToolStart,
                onToolEnd: options.onToolEnd,
            },
            runtimeContext: options.runtimeContext,
            fusedSystemPrompt: [options.systemPrompt.trim(), buildRuntimeContextSection(options).trim()].filter((part) => part.length > 0).join("\n\n"),
            dispose: () => undefined,
        };
        return { session, sessionFile: undefined };
    }
    async promptWithFallback(session, prompt, _options) {
        const resumeId = session.sessionId || undefined;
        const promptWithContext = resumeId
            ? prompt
            : `${session.fusedSystemPrompt}\n\nUser request:\n${prompt}`;
        const result = await invokeHermesCli(promptWithContext, this.settings, resumeId);
        session.sessionId = result.sessionId;
        session.lastModelDescription = this.describeFromSettings();
        if (result.body) {
            session.callbacks.onText?.(result.body);
        }
    }
    describeModel(session) {
        return session.lastModelDescription || this.describeFromSettings();
    }
    async dispose(_session) {
        // No persistent resources to release — the hermes CLI process exits per turn.
    }
    describeFromSettings() {
        const provider = this.settings.provider;
        const model = this.settings.model;
        if (provider && model)
            return `hermes/${provider}/${model}`;
        if (model)
            return `hermes/${model}`;
        if (provider)
            return `hermes/${provider}`;
        return "hermes";
    }
}
//# sourceMappingURL=runtime-adapter.js.map