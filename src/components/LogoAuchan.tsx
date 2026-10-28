import logoComplet from '../assets/logo-auchan.png'
import logoCompact from '../assets/logo-auchan-compact.png'

export function LogoAuchan({ className = '' }: { className?: string }) {
  return (
    <>
      <img
        src={logoCompact}
        alt="Auchan"
        className={`h-9 w-9 object-contain sm:hidden ${className}`}
      />
      <img src={logoComplet} alt="Auchan" className={`hidden h-auto w-auto object-contain sm:block ${className}`} />
    </>
  )
}
