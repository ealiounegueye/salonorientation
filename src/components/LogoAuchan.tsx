import logoAuchan from '../assets/logo-auchan.png'

export function LogoAuchan({ className = '' }: { className?: string }) {
  return <img src={logoAuchan} alt="Auchan" className={className} />
}
