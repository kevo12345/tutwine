/**
 * @deprecated Full-screen live stages now use `position: fixed; inset: 0`.
 * Measuring the visual viewport shrinks Android video when browser chrome or
 * the keyboard opens, so this hook intentionally does nothing.
 */
export function useViewportStageHeight() {}
