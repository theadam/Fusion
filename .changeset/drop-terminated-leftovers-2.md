---
"@fusion/dashboard": patch
---

Drop residual `terminated` AgentState references that the merger autostash dropped during FN-3530 cleanup: `[data-state="terminated"]` selectors in `AgentListModal.css`, `--terminated` CSS-class assertions in `agent-css-classes.test.ts`, and a `state: "terminated"` test fixture in `routes-agents.test.ts` (now `paused`, which is correctly rejected as paused→paused is not a valid transition).
