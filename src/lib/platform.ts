const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** Modifier prefix for shortcut hints: "⌘" on Apple devices, "Ctrl+" elsewhere. */
export const MOD = isMac ? '⌘' : 'Ctrl+'
