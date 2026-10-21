import logoSalon from '../assets/logo-salon.png'

export function LogoSalon({ className = '' }: { className?: string }) {
  return <img src={logoSalon} alt="Auchan — Salon des Métiers" className={className} />
}
