import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, _r) {},
    onRegisterError(error) { console.error('SW register error', error) },
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed bottom-safe inset-x-4 z-[200] flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 shadow-2xl"
      style={{ background: 'var(--primary)', color: 'var(--primary-fg)', bottom: 'max(env(safe-area-inset-bottom, 0px) + 72px, 80px)' }}
    >
      <div>
        <p className="text-sm font-semibold">Mise à jour disponible</p>
        <p className="text-xs opacity-80">Rechargez pour obtenir la dernière version.</p>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        className="flex-shrink-0 rounded-xl px-4 py-2 text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.2)' }}
      >
        Recharger
      </button>
    </div>
  )
}
