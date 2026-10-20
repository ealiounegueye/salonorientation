import type { ReactNode } from 'react'

export function BandeauAuchan({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full bg-white">
      <div className="absolute inset-y-0 left-0 flex w-2 flex-col sm:w-3">
        <div className="flex-[2] bg-red" />
        <div className="flex-1 bg-green" />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-2.25rem)] w-full max-w-lg flex-col px-5 py-8 sm:px-6 sm:py-10">
        {children}
      </div>
    </div>
  )
}
