'use client'
import { useState } from 'react'
import { SearchField, Button, cn } from '@heroui/react'
import { FilterIcon } from '@solar-icons/react/linear'
import { AnimatePresence, motion } from 'framer-motion'
import type {
  PublicCatalogBrowseInput,
  PublicCatalogPage,
} from '@persianpart/contract/public-catalog'
import { setCatalogSearch } from '@/lib/catalog-search'
import { toPersianDigits } from '@/lib/format'
import { CatalogFilterDrawer } from './_catalog-filter-drawer'

type CatalogFiltersProps = {
  input: PublicCatalogBrowseInput
  page: PublicCatalogPage
  search: string
}
export function CatalogFilters({ input, page, search }: CatalogFiltersProps) {
  const [open, setOpen] = useState(false)
  const filterCount =
    input.categoryIds.length +
    input.brandIds.length +
    input.dimensionIds.length +
    input.colors.length +
    input.grades.length +
    input.tagIds.length +
    Number(input.inStock) +
    Number(input.minPrice != null) +
    Number(input.maxPrice != null) +
    Number(!!input.sort && input.sort !== 'default')
  return (
    <>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 text-base">
          <SearchField
            name="search"
            aria-label="جستجو محصولات"
            value={new URLSearchParams(search).get('q') ?? ''}
            onChange={(value) => setCatalogSearch('q', value)}
          >
            <SearchField.Group className="control-height-12 border-0 shadow-none bg-muted/5 px-3 flex items-center">
              <SearchField.SearchIcon />
              <SearchField.Input
                className="w-full text-sm font-base placeholder:text-sm"
                placeholder="جستجو محصولات"
                maxLength={100}
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
        <Button
          type="button"
          onPress={() => setOpen(true)}
          aria-label="فیلترهای پیشرفته"
          className={cn(
            'w-12 control-height-12 px-4 font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer active:scale-95 select-none transition-colors duration-250',
            filterCount
              ? 'bg-control-emphasis'
              : 'bg-muted/5 text-muted hover:bg-default/20 hover:text-foreground',
          )}
        >
          <FilterIcon size={16} />
          <AnimatePresence initial={false}>
            {filterCount > 0 && (
              <motion.span
                initial={{
                  width: 0,
                  opacity: 0,
                  scale: 0.2,
                  marginInlineStart: 0,
                }}
                animate={{
                  width: 'auto',
                  opacity: 1,
                  scale: 1,
                  marginInlineStart: 6,
                }}
                exit={{ width: 0, opacity: 0, scale: 0, marginInlineStart: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden flex items-center justify-center shrink-0 whitespace-nowrap"
              >
                <span className="min-w-4.5 h-4.5 rounded-full bg-white text-primary text-xs font-bold flex items-center justify-center">
                  {toPersianDigits(filterCount)}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
      {page.facets.dimensions.length >= 2 && (
        <div
          className="w-full overflow-x-auto pb-1 pt-0.5 scrollbar-none"
          role="group"
          aria-label="فیلتر ابعاد کاشی و سرامیک"
        >
          <div className="flex min-w-max items-center gap-1.5">
            {[null, ...page.facets.dimensions].map((dimension) => {
              const selected = dimension
                ? input.dimensionIds.includes(dimension.id)
                : !input.dimensionIds.length
              const parts = dimension?.name.split(/[×xX*]/).map((s) => s.trim())
              return (
                <Button
                  key={dimension?.id ?? 'all'}
                  type="button"
                  aria-pressed={selected}
                  onPress={() =>
                    setCatalogSearch(
                      'dimensions',
                      dimension && !selected ? String(dimension.id) : '',
                    )
                  }
                  className={cn(
                    'control-height-10 shrink-0 group select-none whitespace-nowrap px-4 text-xs font-bold transition-colors duration-200',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/5 hover:bg-default/20 text-foreground',
                  )}
                >
                  {parts?.length === 2 ? (
                    <span className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                      <span>{toPersianDigits(parts[0]!)}</span>
                      <span className="opacity-70">×</span>
                      <span>{toPersianDigits(parts[1]!)}</span>
                    </span>
                  ) : dimension ? (
                    toPersianDigits(dimension.name)
                  ) : (
                    'همه'
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}
      <CatalogFilterDrawer
        open={open}
        onClose={() => setOpen(false)}
        input={input}
        page={page}
      />
      <div className="flex items-center justify-between gap-2 mt-2 px-1 py-1 min-h-7 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-foreground leading-5">
            لیست محصولات
          </h1>
          {filterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                window.history.replaceState(null, '', '/')
                window.dispatchEvent(new Event('catalog:navigation'))
              }}
              className="text-xs font-semibold m-0! p-0! px-1.5! h-5! min-h-0! bg-transparent! text-primary cursor-pointer hover:bg-transparent! hover:opacity-80 transition-opacity"
            >
              پاک کردن فیلترها ({toPersianDigits(filterCount)})
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
