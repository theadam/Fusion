---
"@runfusion/fusion": patch
---

Fix ChatView composer sliding over messages on mobile when the user
swipes with the keyboard up. The visualViewport `--vv-height` and
`--vv-offset-top` CSS vars were being routed through React state, so
on iOS — which fires visualViewport scroll/resize on the same frame
as its keyboard animation — the thread translation lagged by one
paint. The composer briefly appeared to slide over the message list
during a pan. The vars are now written imperatively in a
`useLayoutEffect` directly to the `.chat-thread` element on every
visualViewport event, mirroring the working pattern in
`QuickChatFAB.tsx:1032-1052`. Only `--keyboard-overlap` (a structural
open/close signal) still goes through React state.
