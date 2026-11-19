import type { PublicCatalogPage } from '@persianpart/contract/public-catalog'

export function CatalogContact({
  config,
}: {
  config: PublicCatalogPage['config']
}) {
  if (!config.contact.length) return null
  return (
    <footer className="catalog-contact" aria-label="راه‌های ارتباطی">
      <span>راه‌های ارتباطی</span>
      {config.contact.map((channel) => (
        <a
          key={`${channel.type}:${channel.url}`}
          href={channel.url}
          rel="noopener noreferrer"
        >
          {channel.label}
        </a>
      ))}
    </footer>
  )
}
