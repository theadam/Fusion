export declare const FUSION_SKILL_NAME = "fusion";
export type HermesFusionSkillInstallOutcome = "installed" | "already-installed" | "replaced" | "skipped" | "warning";
export interface HermesFusionSkillInstallResult {
    outcome: HermesFusionSkillInstallOutcome;
    sourceDir: string | null;
    targetDir: string;
    reason?: string;
}
export declare function resolveHermesHome(profile?: string): string;
export declare function getFusionSkillSourceCandidates(moduleUrl?: string): string[];
export declare function resolveBundledFusionSkillSource(): string | null;
export declare function resolveBundledFusionSkillSourceFromCandidates(candidates: string[]): string | null;
export declare function installFusionSkillIntoHermesHome(options?: {
    profile?: string;
    sourceDir?: string | null;
}): HermesFusionSkillInstallResult;
//# sourceMappingURL=fusion-skill-install.d.ts.map