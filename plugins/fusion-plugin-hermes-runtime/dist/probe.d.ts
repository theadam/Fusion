/**
 * Hermes binary probe helper.
 *
 * Mirrors the probeClaudeCli pattern from packages/dashboard/src/claude-cli-probe.ts.
 * Never throws — all failures are captured as `available: false` with a reason.
 */
/**
 * Result of probing for the hermes binary.
 */
export interface HermesBinaryStatus {
    /** True if the binary was found and ran to completion successfully. */
    available: boolean;
    /** Absolute path resolved via `which`/`where`, if found. */
    binaryPath?: string;
    /** Version string from `hermes --version` stdout, if available. */
    version?: string;
    /** Human-readable failure reason when `available === false`. */
    reason?: string;
    /** Wall-clock duration of the probe in milliseconds. */
    probeDurationMs: number;
}
/**
 * Probe for the hermes binary.
 *
 * Runs `<binaryPath> --version` with a short timeout. Use this from
 * the dashboard status endpoint to check binary presence without crashing.
 *
 * @param opts.binaryPath - Override the binary path (default: "hermes").
 * @param opts.timeoutMs  - Override probe timeout in ms (default: 2000).
 */
export declare function probeHermesBinary(opts?: {
    binaryPath?: string;
    timeoutMs?: number;
}): Promise<HermesBinaryStatus>;
//# sourceMappingURL=probe.d.ts.map