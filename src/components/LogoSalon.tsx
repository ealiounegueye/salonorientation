import logoSalon from '../assets/logo-sdm.png'

export function LogoSalon({ className = '' }: { className?: string }) {
  return (
    <img
      src={logoSalon}
      alt="Salon des Métiers & des Associations"
      className={`block h-auto w-full max-w-full min-w-0 ${className}`}
    />
  )
}
