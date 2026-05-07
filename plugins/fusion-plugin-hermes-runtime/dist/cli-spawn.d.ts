/**
 * Hermes CLI spawn module.
 *
 * Drives the local `hermes` binary as a subprocess instead of using the
 * @mariozechner/pi-ai SDK. Session continuity is maintained by capturing
 * the `session_id:` line from stdout and passing `--resume <id>` on
 * subsequent invocations.
 *
 * There is NO per-token streaming on this surface — `hermes chat -q`
 * buffers output in prompt_toolkit. The full response is delivered in
 * one chunk once the process exits.
 */
/**
 * Summary of a single Hermes profile as returned by `hermes profile list`.
 */
export interface HermesProfileSummary {
    /** Profile name, e.g. "default". */
    name: string;
    /** Model configured for this profile, if any. */
    model?: string;
    /** Gateway status string, e.g. "stopped". */
    gateway?: string;
    /** Alias wrapper script name, if set. */
    alias?: string;
    /** True when this profile has the `◆` sticky-default marker. */
    isDefault: boolean;
}
/**
 * List all Hermes profiles by running `hermes profile list`.
 *
 * @param opts.binaryPath  - Path to the hermes binary (default: "hermes").
 * @param opts.timeoutMs   - Maximum wait time in ms (default: 5000).
 * @returns Array of profile summaries, ordered as hermes returns them.
 * @throws When hermes is not found (ENOENT) or exits non-zero.
 */
export declare function listHermesProfiles(opts?: {
    binaryPath?: string;
    timeoutMs?: number;
}): Promise<HermesProfileSummary[]>;
/**
 * Settings resolved from plugin ctx.settings + env-var fallbacks.
 */
export interface HermesCliSettings {
    /** Path to the hermes binary. Default: "hermes" (rely on PATH). */
    binaryPath: string;
    /** Model identifier, e.g. "claude-sonnet-4-5". */
    model?: string;
    /** Provider identifier, e.g. "anthropic". */
    provider?: string;
    /** Maximum agent turns per invocation. Default: 12. */
    maxTurns: number;
    /** Pass --yolo to hermes (skip confirmations). Default: false. */
    yolo: boolean;
    /** Hard kill timeout in milliseconds. Default: 300000 (5 min). */
    cliTimeoutMs: number;
    /**
     * Hermes profile name to activate when spawning the CLI.
     * Implemented by setting HERMES_HOME to the profile directory in the
     * subprocess environment — hermes has no `--profile` CLI flag on `chat`.
     * Empty string / undefined = use the current sticky-default profile.
     */
    profile?: string;
}
/** Result of a single hermes CLI invocation. */
export interface HermesCliResult {
    /** Parsed assistant response text. */
    body: string;
    /** The session id captured from stdout (used for --resume on next call). */
    sessionId: string;
}
/**
 * Resolve HermesCliSettings from a plugin settings record and environment
 * variable fallbacks.
 */
export declare function resolveCliSettings(settings?: Record<string, unknown>): HermesCliSettings;
/**
 * Parse the raw stdout from `hermes chat -q ... -Q`.
 *
 * Returns `{ body, sessionId }` on success or throws with a descriptive error.
 */
export declare function parseHermesOutput(rawStdout: string, rawStderr: string): HermesCliResult;
/**
 * Build the argv array for a `hermes chat` invocation.
 */
export declare function buildHermesArgs(prompt: string, settings: HermesCliSettings, resumeSessionId?: string): string[];
/**
 * Invoke the hermes CLI for a single prompt/response turn.
 *
 * @param prompt - The user prompt to send.
 * @param settings - Resolved CLI settings.
 * @param resumeSessionId - Hermes session id from a prior call, if continuing.
 * @param signal - Optional AbortSignal; will SIGTERM the subprocess on abort.
 * @returns Parsed response body and the new/existing session id.
 */
export declare function invokeHermesCli(prompt: string, settings: HermesCliSettings, resumeSessionId?: string, signal?: AbortSignal): Promise<HermesCliResult>;
//# sourceMappingURL=cli-spawn.d.ts.map