import { Link } from 'react-router-dom'

export interface BreadcrumbItem {
  label: string
  to?: string
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {item.to && !isLast ? (
                <Link to={item.to} className="transition hover:text-ink hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'text-ink' : undefined}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span aria-hidden="true" className="text-muted/70">
                  /
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
