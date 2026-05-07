---
"@runfusion/fusion": patch
---

Two mobile chat fixes:

1. Tapping the ChatView send button no longer dismisses the soft
   keyboard. preventDefault now fires on `pointerdown` for touch
   pointers (before iOS blurs the textarea — the synthesized mousedown
   it previously relied on fires too late). Click still runs the send
   action so quick taps remain reliable.

2. The bottom executor status bar is now hidden on mobile while the
   keyboard is open, mirroring `MobileNavBar`. The bar is
   `position: fixed` against the layout viewport, which iOS leaves
   anchored below the keyboard — during a swipe/pan it would slide
   over the message list.
