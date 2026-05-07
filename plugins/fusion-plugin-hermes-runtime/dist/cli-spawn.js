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
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path, { sep as PATH_SEP } from "node:path";
/**
 * On Windows, `spawn("hermes", ...)` won't find `hermes.cmd`/`.bat` shims —
 * Node doesn't honor PATHEXT. We resolve via `where` (which does) and spawn
 * the absolute path instead. No-op on POSIX. Cached per process.
 */
const resolvedBinaryCache = new Map();
function resolveBinaryForSpawn(binary) {
    if (process.platform !== "win32")
        return binary;
    if (binary.includes(PATH_SEP) || binary.includes("/") || /\.[a-z]{2,4}$/i.test(binary)) {
        return binary;
    }
    const cached = resolvedBinaryCache.get(binary);
    if (cached)
        return cached;
    try {
        const result = spawnSync("where", [binary], { encoding: "utf-8" });
        if (result.status === 0) {
            const first = (result.stdout ?? "").trim().split(/\r?\n/)[0];
            if (first?.length) {
                resolvedBinaryCache.set(binary, first);
                return first;
            }
        }
    }
    catch {
        // fall through
    }
    return binary;
}
/** ANSI escape code stripping regex. */
// eslint-disable-next-line no-control-regex -- ANSI escapes are control chars by definition
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]/g;
/** Pattern to locate the session id appended by hermes near end of stdout. */
const SESSION_ID_RE = /^session_id:\s+([0-9]{8}_[0-9]{6}_[0-9a-f]{6})\s*$/m;
/** Lines that are part of the hermes TUI chrome and should be stripped from the body. */
const CHROME_LINE_RES = [
    /^\s*┊\s/, // memory/status sidebar lines
    /^↻ Resumed session /, // resume banner
    /^╭─.*╮\s*$/, // top box border
    /^╰─.*╯\s*$/, // bottom box border
    /^Query:\s*/, // query echo line
];
/** Regex matching lines made entirely of `─` box-drawing chars (the rule row). */
const PROFILE_RULE_RE = /^[\s─]+$/;
/** Em-dash placeholder used by `hermes profile list` for empty values. */
const EM_DASH = "—";
/**
 * Parse the stdout of `hermes profile list` into an array of profile summaries.
 *
 * The output looks like:
 *
 * ```
 *  Profile          Model                        Gateway      Alias
 *  ───────────────  ─────────────────────────    ───────────  ────────────
 *  ◆default         MiniMax-M2.7                 stopped      —
 * ```
 *
 * Columns are whitespace-aligned (variable-width). The function splits on runs
 * of two-or-more spaces to handle variable column widths robustly.
 */
function parseProfileListOutput(raw) {
    const lines = raw.replace(ANSI_RE, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const profiles = [];
    for (const line of lines) {
        // Skip blank lines.
        if (line.trim() === "")
            continue;
        // Skip the header line (starts with " Profile").
        if (/^\s*Profile\b/.test(line))
            continue;
        // Skip rule lines (all box-drawing dashes / spaces).
        if (PROFILE_RULE_RE.test(line))
            continue;
        // Split on 2+ spaces to separate columns. Trim leading space first.
        const stripped = line.replace(/^\s+/, "");
        const columns = stripped.split(/\s{2,}/);
        const rawName = columns[0] ?? "";
        const isDefault = rawName.startsWith("◆");
        const name = rawName.replace(/^◆/, "").trim();
        if (!name)
            continue;
        const toUndef = (v) => v === undefined || v.trim() === "" || v.trim() === EM_DASH ? undefined : v.trim();
        profiles.push({
            name,
            model: toUndef(columns[1]),
            gateway: toUndef(columns[2]),
            alias: toUndef(columns[3]),
            isDefault,
        });
    }
    return profiles;
}
/**
 * Resolve the HERMES_HOME directory for a named profile.
 *
 * Mirrors hermes's own logic:
 *  - "default"  → ~/.hermes
 *  - other name → ~/.hermes/profiles/<name>
 *
 * This is used to set HERMES_HOME when spawning hermes with a specific profile.
 */
function hermesProfileHome(profileName) {
    const base = process.env.HERMES_HOME ?? path.join(os.homedir(), ".hermes");
    if (profileName === "default" || profileName === "")
        return base;
    return path.join(base, "profiles", profileName);
}
/**
 * List all Hermes profiles by running `hermes profile list`.
 *
 * @param opts.binaryPath  - Path to the hermes binary (default: "hermes").
 * @param opts.timeoutMs   - Maximum wait time in ms (default: 5000).
 * @returns Array of profile summaries, ordered as hermes returns them.
 * @throws When hermes is not found (ENOENT) or exits non-zero.
 */
export async function listHermesProfiles(opts) {
    const binary = resolveBinaryForSpawn(opts?.binaryPath ?? "hermes");
    const timeoutMs = opts?.timeoutMs ?? 5_000;
    return new Promise((resolve, reject) => {
        let settled = false;
        const child = spawn(binary, ["profile", "list"], {
            stdio: ["ignore", "pipe", "pipe"],
            env: { ...process.env },
        });
        const timer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            try {
                child.kill("SIGKILL");
            }
            catch { /* already gone */ }
            reject(new Error(`hermes profile list failed: timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk) => { stdout += chunk.toString("utf-8"); });
        child.stderr?.on("data", (chunk) => { stderr += chunk.toString("utf-8"); });
        child.on("error", (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            const isNotFound = err.code === "ENOENT";
            reject(new Error(isNotFound
                ? `hermes profile list failed: binary not found at "${opts?.binaryPath ?? "hermes"}"`
                : `hermes profile list failed: ${err.message}`));
        });
        child.on("close", (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            if (code !== 0) {
                const combined = [stdout, stderr].filter(Boolean).join("\n");
                reject(new Error(`hermes profile list failed: process exited with code ${String(code)}.\n${combined}`));
                return;
            }
            resolve(parseProfileListOutput(stdout));
        });
    });
}
/**
 * Resolve HermesCliSettings from a plugin settings record and environment
 * variable fallbacks.
 */
export function resolveCliSettings(settings) {
    const str = (v) => typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
    const num = (v, envKey, fallback) => {
        // Accept numeric values directly.
        if (typeof v === "number" && Number.isFinite(v) && v > 0)
            return v;
        const raw = str(v) ?? str(process.env[envKey]);
        if (raw !== undefined) {
            const parsed = Number(raw);
            if (Number.isFinite(parsed) && parsed > 0)
                return parsed;
        }
        return fallback;
    };
    const bool = (v, envKey, fallback) => {
        if (typeof v === "boolean")
            return v;
        const raw = str(v) ?? str(process.env[envKey]);
        if (raw !== undefined)
            return raw === "1" || raw.toLowerCase() === "true";
        return fallback;
    };
    return {
        binaryPath: str(settings?.binaryPath) ?? str(process.env.HERMES_BIN) ?? "hermes",
        model: str(settings?.model) ?? str(process.env.HERMES_MODEL_ID),
        provider: str(settings?.provider) ?? str(process.env.HERMES_PROVIDER),
        maxTurns: num(settings?.maxTurns, "HERMES_MAX_TURNS", 12),
        yolo: bool(settings?.yolo, "HERMES_YOLO", false),
        cliTimeoutMs: num(settings?.cliTimeoutMs, "HERMES_CLI_TIMEOUT_MS", 300_000),
        profile: str(settings?.profile) ?? str(process.env.HERMES_PROFILE),
    };
}
/**
 * Strip ANSI escape codes and normalize CRLF to LF.
 */
function cleanText(raw) {
    return raw.replace(ANSI_RE, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
/**
 * Remove hermes TUI chrome lines from the captured body.
 */
function stripChrome(text) {
    const lines = text.split("\n");
    const filtered = lines.filter((line) => !CHROME_LINE_RES.some((re) => re.test(line)));
    return filtered.join("\n").trim();
}
/**
 * Parse the raw stdout from `hermes chat -q ... -Q`.
 *
 * Returns `{ body, sessionId }` on success or throws with a descriptive error.
 */
export function parseHermesOutput(rawStdout, rawStderr) {
    const cleaned = cleanText(rawStdout);
    const match = SESSION_ID_RE.exec(cleaned);
    if (!match) {
        const combined = [rawStdout, rawStderr].filter(Boolean).join("\n");
        throw new Error(`hermes: missing session_id in output.\n${combined}`);
    }
    const sessionId = match[1];
    // Body is everything before the session_id line.
    const sessionIdLineStart = cleaned.lastIndexOf("\nsession_id:");
    const bodyRaw = sessionIdLineStart >= 0 ? cleaned.slice(0, sessionIdLineStart) : cleaned;
    const body = stripChrome(bodyRaw);
    return { body, sessionId };
}
/**
 * Build the argv array for a `hermes chat` invocation.
 */
export function buildHermesArgs(prompt, settings, resumeSessionId) {
    const args = ["chat", "-q", prompt, "-Q", "--source", "tool"];
    if (resumeSessionId) {
        args.push("--resume", resumeSessionId);
    }
    if (settings.model) {
        args.push("-m", settings.model);
    }
    if (settings.provider) {
        args.push("--provider", settings.provider);
    }
    args.push("--max-turns", String(settings.maxTurns));
    if (settings.yolo) {
        args.push("--yolo");
    }
    return args;
}
/**
 * Invoke the hermes CLI for a single prompt/response turn.
 *
 * @param prompt - The user prompt to send.
 * @param settings - Resolved CLI settings.
 * @param resumeSessionId - Hermes session id from a prior call, if continuing.
 * @param signal - Optional AbortSignal; will SIGTERM the subprocess on abort.
 * @returns Parsed response body and the new/existing session id.
 */
export async function invokeHermesCli(prompt, settings, resumeSessionId, signal) {
    const args = buildHermesArgs(prompt, settings, resumeSessionId);
    const binary = resolveBinaryForSpawn(settings.binaryPath);
    return new Promise((resolve, reject) => {
        let settled = false;
        const spawnEnv = { ...process.env, PYTHONUNBUFFERED: "1" };
        if (settings.profile) {
            spawnEnv.HERMES_HOME = hermesProfileHome(settings.profile);
        }
        const child = spawn(binary, args, {
            stdio: ["ignore", "pipe", "pipe"],
            env: spawnEnv,
        });
        const hardKillTimer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            try {
                child.kill("SIGKILL");
            }
            catch {
                // already gone
            }
            reject(new Error(`hermes: process timed out after ${settings.cliTimeoutMs}ms`));
        }, settings.cliTimeoutMs);
        // Forward AbortSignal.
        const onAbort = () => {
            if (settled)
                return;
            settled = true;
            clearTimeout(hardKillTimer);
            try {
                child.kill("SIGTERM");
            }
            catch {
                // already gone
            }
            reject(new Error("hermes: invocation aborted"));
        };
        if (signal) {
            if (signal.aborted) {
                onAbort();
                return;
            }
            signal.addEventListener("abort", onAbort, { once: true });
        }
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString("utf-8");
        });
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString("utf-8");
        });
        child.on("error", (err) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(hardKillTimer);
            signal?.removeEventListener("abort", onAbort);
            const isNotFound = err.code === "ENOENT";
            reject(new Error(isNotFound
                ? `hermes: binary not found at "${settings.binaryPath}". Install hermes or set binaryPath/HERMES_BIN.`
                : `hermes: spawn error — ${err.message}`));
        });
        child.on("close", (code) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(hardKillTimer);
            signal?.removeEventListener("abort", onAbort);
            if (code !== 0) {
                const combined = [stdout, stderr].filter(Boolean).join("\n");
                reject(new Error(`hermes: process exited with code ${String(code)}.\n${combined}`));
                return;
            }
            try {
                resolve(parseHermesOutput(stdout, stderr));
            }
            catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}
//# sourceMappingURL=cli-spawn.js.map