# Task Lineage Reconciliation Notes

## FN-3953 historical mismatch (GitHub-tracking vs current task)

- Historical commit subject evidence:
  - `6871c510a feat(FN-3953): enable tracking issue creation on task edit and document the...`
- Current unrelated FN-3953 evidence:
  - `f6a1862f9 feat(FN-3953): wire agent provisioning approval policy into engine tools`
- Reconciled GitHub-tracking task lineage: `FN-3874`, `FN-3940`, `FN-3943`
- Summary: raw task-ID references in historical commits can map to different board meanings over time; therefore historical attribution must use immutable lineage IDs plus persisted association records rather than display task ID alone.
- Confidence: high
