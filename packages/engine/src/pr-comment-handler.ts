import type { TaskStore } from "@fusion/core";
import type { PrInfo } from "@fusion/core";
import { prMonitorLog } from "./logger.js";

interface PrComment {
  id: number;
  body: string;
  user: { login: string };
  created_at: string;
  updated_at: string;
  html_url: string;
}

/**
 * Analyzes PR comments for actionable feedback and creates
 * steering comments or follow-up tasks.
 */
export class PrCommentHandler {
  // Non-actionable patterns to filter out (true noise only — anything more
  // nuanced is the agent's job to judge once the comment is injected).
  private readonly NON_ACTIONABLE_PATTERNS = [
    /^\s*lgtm\s*$/i,
    /^\s*looks? good\s*$/i,
    /^\s*thanks?\s*$/i,
    /^\s*thank you\s*$/i,
    /^\s*nice\s*$/i,
    /^\s*great\s*$/i,
    /^\s*awesome\s*$/i,
    /^\s*👍\s*$/,
    /^\s*✅\s*$/,
  ];

  constructor(private store: TaskStore) {}

  /**
   * Process new PR comments for a task.
   * Called by PrMonitor when new comments are detected.
   */
  async handleNewComments(
    taskId: string,
    prInfo: PrInfo,
    comments: PrComment[]
  ): Promise<void> {
    for (const comment of comments) {
      await this.processComment(taskId, prInfo, comment);
    }
  }

  private async processComment(
    taskId: string,
    prInfo: PrInfo,
    comment: PrComment
  ): Promise<void> {
    // Skip only the obvious noise (LGTM / thanks / emoji-only). Everything
    // else flows through to the agent as a steering comment — the agent is
    // the right place to decide what's actionable, not a keyword whitelist.
    if (this.isNonActionable(comment.body)) {
      prMonitorLog.log(`Skipping non-actionable comment #${comment.id}`);
      return;
    }

    const hasCodeSuggestions = this.hasCodeBlock(comment.body);

    // Build comment text
    const text = this.buildCommentText(prInfo, comment, hasCodeSuggestions);

    try {
      await this.store.addTaskComment(taskId, text, "agent");
      await this.upsertReviewItem(taskId, prInfo, comment, "queued");
      prMonitorLog.log(`Added comment for PR review #${comment.id}`);
    } catch (err) {
      prMonitorLog.error(`Failed to add comment for ${taskId}:`, err);
    }
  }

  /**
   * Check if a comment is non-actionable (LGTM, thanks, etc.)
   */
  private isNonActionable(body: string): boolean {
    const trimmed = body.trim();
    return this.NON_ACTIONABLE_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  /**
   * Check if a comment contains code blocks suggesting changes.
   */
  private hasCodeBlock(body: string): boolean {
    // Look for code blocks (``` or `code`)
    return /```[\s\S]*?```/.test(body) || /`[^`]+`/.test(body);
  }

  /**
   * Build comment text from PR review comment.
   */
  private buildCommentText(
    prInfo: PrInfo,
    comment: PrComment,
    hasCodeSuggestions: boolean
  ): string {
    const lines: string[] = [];

    lines.push(`**PR Review Feedback** from @${comment.user.login}`);
    lines.push(`**PR:** #${prInfo.number} (${prInfo.status})`);
    if (prInfo.status !== "open") {
      lines.push(`**Note:** This PR is already ${prInfo.status}. Treat the feedback as follow-up work.`);
    }
    lines.push("");

    // Truncate comment body if too long
    const maxBodyLength = 500;
    let body = comment.body.trim();
    if (body.length > maxBodyLength) {
      body = body.slice(0, maxBodyLength) + "...";
    }
    lines.push(body);
    lines.push("");

    if (hasCodeSuggestions) {
      lines.push("💡 This comment contains code suggestions. Please review and apply if appropriate.");
    }

    lines.push(`[View on GitHub](${comment.html_url})`);

    return lines.join("\n");
  }

  /**
   * Handle "changes requested" PR review state.
   * Moves the task back to in-progress with reviewer feedback as a steering comment,
   * closing the feedback loop so the agent can address the requested changes.
   */
  async handleChangesRequested(
    taskId: string,
    prInfo: PrInfo,
    reviewerLogin: string,
    reviewBody: string,
  ): Promise<void> {
    try {
      const task = await this.store.getTask(taskId);
      if (task.column !== "in-review") {
        prMonitorLog.log(`Task ${taskId} not in-review (${task.column}), skipping changes-requested handling`);
        return;
      }

      // Add reviewer feedback as a steering comment
      const feedbackText = [
        `**Changes Requested** by @${reviewerLogin} on PR #${prInfo.number}`,
        "",
        reviewBody ? reviewBody.slice(0, 800) : "(no review body)",
        "",
        "Please address the requested changes and update the PR.",
      ].join("\n");

      await this.store.addTaskComment(taskId, feedbackText, "agent");
      await this.upsertReviewItem(
        taskId,
        prInfo,
        {
          id: Date.now(),
          body: reviewBody || "(no review body)",
          user: { login: reviewerLogin },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          html_url: prInfo.url,
        },
        "queued",
      );
      await this.store.moveTask(taskId, "in-progress");
      await this.store.logEntry(
        taskId,
        `PR #${prInfo.number}: changes requested by @${reviewerLogin} — moved back to in-progress`,
      );
      prMonitorLog.log(`Task ${taskId} moved to in-progress after changes requested on PR #${prInfo.number}`);
    } catch (err) {
      prMonitorLog.error(`Failed to handle changes-requested for ${taskId}:`, err);
    }
  }

  /**
   * Handle unaddressed PR comments that arrived while a PR was open and
   * weren't acted on before the PR was merged or closed.
   *
   * Original behaviour spawned a sibling task ("Follow-up: Address PR
   * feedback") in triage. That fragments the project board and forces the
   * user to manage two tickets for one logical piece of work. Preferred
   * behaviour is to **reopen the original task in place**: clear its merged
   * PR info so a fresh PR can be opened, surface the comments as steering
   * input, and move it back into the working columns. The agent will pick
   * it up on the next scheduler tick and open a new PR off main with the
   * fixes.
   *
   * Method name retained for backwards compatibility with the
   * `onClosedPrFeedback` wiring in project-engine / runtimes.
   */
  async createFollowUpTask(
    originalTaskId: string,
    prInfo: PrInfo,
    unaddressedComments: PrComment[]
  ): Promise<void> {
    if (unaddressedComments.length === 0) return;

    try {
      // Inject each unaddressed comment as a steering input on the original
      // task. Re-uses the same formatter the in-review flow uses so the
      // payload looks identical to "address pre-merge" feedback.
      for (const comment of unaddressedComments) {
        const text = this.buildCommentText(prInfo, comment, this.hasCodeBlock(comment.body));
        await this.store.addTaskComment(originalTaskId, text, "agent");
      }

      // Clear the merged PR info so the agent's next pass opens a fresh PR
      // against main, instead of trying to re-use the merged branch.
      await this.store.updatePrInfo(originalTaskId, null);

      // Reopen the task so the scheduler picks it up. todo (not in-progress)
      // because the worktree was cleaned up after merge — the executor needs
      // to recreate one. The scheduler will rebase a fresh worktree and run.
      await this.store.moveTask(originalTaskId, "todo");

      await this.store.logEntry(
        originalTaskId,
        `Reopened with ${unaddressedComments.length} unaddressed PR comment(s) after PR #${prInfo.number} ${prInfo.status}`,
      );

      prMonitorLog.log(
        `Reopened ${originalTaskId} for ${unaddressedComments.length} unaddressed comment(s) on PR #${prInfo.number}`
      );
    } catch (err) {
      prMonitorLog.error(`Failed to reopen ${originalTaskId} for PR feedback:`, err);
    }
  }

  private async upsertReviewItem(
    taskId: string,
    prInfo: PrInfo,
    comment: PrComment,
    status: "queued" | "in-progress" | "addressed" | "failed",
  ): Promise<void> {
    const task = await this.store.getTask(taskId);
    const now = new Date().toISOString();
    const current = task.review ?? {
      mode: "pull-request",
      source: "github-pr",
      decision: "pending",
      items: [],
      selectedItemIds: [],
    };
    const itemId = `gh-comment-${comment.id}`;
    const existingIndex = current.items.findIndex((item: { id: string }) => item.id === itemId);
    const nextItem = {
      id: itemId,
      source: "github-pr" as const,
      status,
      summary: comment.body.trim().slice(0, 160) || `Feedback from @${comment.user.login}`,
      body: comment.body,
      reviewer: comment.user.login,
      commentUrl: comment.html_url,
      createdAt: comment.created_at,
      updatedAt: now,
    };
    const nextItems = [...current.items];
    if (existingIndex >= 0) {
      nextItems[existingIndex] = { ...nextItems[existingIndex], ...nextItem };
    } else {
      nextItems.push(nextItem);
    }

    const currentReviewState = task.reviewState ?? {
      source: "pull-request" as const,
      items: [],
      addressing: [],
    };
    const existingReviewStateIndex = currentReviewState.items.findIndex((item) => item.id === itemId);
    const nextReviewStateItem = {
      id: itemId,
      githubCommentId: comment.id,
      body: comment.body,
      author: { login: comment.user.login },
      createdAt: comment.created_at,
      updatedAt: now,
      htmlUrl: comment.html_url,
      source: "github-pr" as const,
    };
    const nextReviewStateItems = [...currentReviewState.items];
    if (existingReviewStateIndex >= 0) {
      nextReviewStateItems[existingReviewStateIndex] = { ...nextReviewStateItems[existingReviewStateIndex], ...nextReviewStateItem };
    } else {
      nextReviewStateItems.push(nextReviewStateItem);
    }

    await this.store.updateTask(taskId, {
      review: {
        ...current,
        mode: "pull-request",
        source: "github-pr",
        summary: `PR #${prInfo.number} feedback items: ${nextItems.length}`,
        latestRefreshAt: now,
        items: nextItems,
      },
      reviewState: {
        ...currentReviewState,
        source: "pull-request",
        summary: currentReviewState.summary,
        items: nextReviewStateItems,
      },
    });
  }
}
