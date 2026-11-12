interface InstallPrompt extends Event {
  prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: InstallPrompt
  }
}

let pendingPrompt: InstallPrompt | null = null
const changes = new EventTarget()

function setPrompt(prompt: InstallPrompt | null) {
  pendingPrompt = prompt
  changes.dispatchEvent(new Event('change'))
}

// Capture the native prompt even if the React layout has not mounted yet.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  setPrompt(event)
})
window.addEventListener('appinstalled', () => setPrompt(null))

export function subscribeToInstallPrompt(listener: () => void) {
  changes.addEventListener('change', listener)
  return () => changes.removeEventListener('change', listener)
}

export function getInstallPrompt() {
  return pendingPrompt
}

export function takeInstallPrompt() {
  const prompt = pendingPrompt
  if (prompt) setPrompt(null)
  return prompt
}
