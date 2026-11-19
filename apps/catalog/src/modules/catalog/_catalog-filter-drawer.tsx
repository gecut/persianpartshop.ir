'use client'
import { Button, Drawer, Switch, cn } from '@heroui/react'
import { CloseIcon, RestartIcon } from '@solar-icons/react/linear'
import { StarIcon } from '@solar-icons/react/bold'
import { PRODUCT_GRADE_OPTIONS } from '@persianpart/contract'
import type {
  PublicCatalogBrowseInput,
  PublicCatalogPage,
} from '@persianpart/contract/public-catalog'
import { setCatalogSearch } from '@/lib/catalog-search'
import { toPersianDigits } from '@/lib/format'
import { FilterSelect } from './_filter-select'

type CatalogFilterDrawerProps = {
  open: boolean
  onClose: () => void
  input: PublicCatalogBrowseInput
  page: PublicCatalogPage
}
const sorts = [
  { id: 'default', label: 'پیش‌فرض' },
  { id: 'cheapest', label: 'ارزان‌ترین' },
  { id: 'expensive', label: 'گران‌ترین' },
  { id: 'newest', label: 'جدیدترین' },
  { id: 'oldest', label: 'قدیمی‌ترین' },
]
export function CatalogFilterDrawer({
  open,
  onClose,
  input,
  page,
}: CatalogFilterDrawerProps) {
  const { facets, config } = page
  function reset() {
    window.history.replaceState(null, '', '/')
    window.dispatchEvent(new Event('catalog:navigation'))
  }
  return (
    <Drawer.Backdrop
      isOpen={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      className="fixed z-50 backdrop-blur-xs min-h-60 flex items-end justify-center fade-up transition-all duration-300"
    >
      <Drawer.Content
        placement="bottom"
        className="w-full max-w-xl mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[88dvh] sm:max-h-[85dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0! shadow-2xl"
      >
        <Drawer.Dialog className="flex flex-col h-auto! max-h-[88dvh] sm:max-h-[85dvh] min-h-0 bg-surface outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
          <div className="flex justify-center w-full shrink-0 pt-2.5 pb-1">
            <Drawer.Handle className="w-16 h-1.5 rounded-full" />
          </div>
          <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-2 pb-2 shrink-0">
            <Drawer.Heading className="w-full text-sm font-extrabold text-foreground flex items-center gap-2">
              مرتب‌سازی
            </Drawer.Heading>
            <Button
              type="button"
              onPress={onClose}
              aria-label="بستن"
              className="w-10 control-height-10 bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <CloseIcon size={20} />
            </Button>
          </Drawer.Header>
          <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-3 scrollbar-none">
            {config.stockMode !== 'hidden' && (
              <div className="py-4 px-4 rounded-2xl bg-muted/5 flex items-center justify-between cursor-pointer select-none">
                <div>
                  <span className="text-xs font-black text-foreground block">
                    فقط کالاهای موجود
                  </span>
                  <span className="text-xs text-muted font-medium block mt-0.5">
                    عدم نمایش کالاهای ناموجود در انبار
                  </span>
                </div>
                <Switch
                  isSelected={input.inStock}
                  onChange={(value) =>
                    setCatalogSearch('inStock', value ? '1' : '')
                  }
                  aria-label="فقط کالاهای موجود"
                  className="group rounded-full"
                >
                  <Switch.Content className="rounded-full">
                    <Switch.Control
                      className={cn(
                        'rounded-full w-16! h-8! min-w-16! min-h-8! max-w-16! max-h-8! flex items-center transition-colors',
                        input.inStock ? 'bg-primary!' : 'bg-muted/20!',
                      )}
                    >
                      <Switch.Thumb
                        className={cn(
                          'rounded-full w-8! h-6.5! min-w-8! min-h-6.5! max-w-8! max-h-6.5! shrink-0! bg-white shadow-sm transition-[margin] duration-200 ease-out',
                          input.inStock ? 'ms-[calc(100%-35px)]!' : 'ms-0.75!',
                        )}
                      />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </div>
            )}
            <FilterSelect
              label="مرتب‌سازی بر اساس"
              selected={[input.sort ?? config.sort]}
              options={sorts.filter(
                (option) =>
                  config.showPrice ||
                  !['cheapest', 'expensive'].includes(option.id),
              )}
              onChange={(ids) => setCatalogSearch('sort', ids[0] ?? 'default')}
            />
            <FilterSelect
              label="ابعاد کاشی و سرامیک"
              selected={[String(input.dimensionIds[0] ?? 'all')]}
              options={[
                { id: 'all', label: 'همه ابعاد' },
                ...facets.dimensions.map((item) => ({
                  id: String(item.id),
                  label: toPersianDigits(item.name),
                })),
              ]}
              onChange={(ids) =>
                setCatalogSearch(
                  'dimensions',
                  ids[0] === 'all' ? '' : ids.join(','),
                )
              }
            />
            {!!facets.grades.length && (
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <StarIcon size={16} className="text-primary" />
                  <span className="text-xs font-bold text-foreground block">
                    درجه کیفی
                  </span>
                </div>
                <div
                  role="group"
                  aria-label="درجه کیفی"
                  className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-muted/10 p-1"
                >
                  {PRODUCT_GRADE_OPTIONS.map(({ value, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant={
                        input.grades.includes(value) ? 'primary' : 'ghost'
                      }
                      aria-pressed={input.grades.includes(value)}
                      onPress={() =>
                        setCatalogSearch(
                          'grades',
                          (input.grades.includes(value)
                            ? input.grades.filter((item) => item !== value)
                            : [...input.grades, value]
                          ).join(','),
                        )
                      }
                      className="h-12 min-w-0 gap-1 rounded-xl px-1 text-xs font-bold aria-pressed:font-black"
                    >
                      <StarIcon
                        size={13}
                        className={
                          input.grades.includes(value)
                            ? 'text-primary-foreground'
                            : 'text-primary/80'
                        }
                      />
                      <bdi>{label}</bdi>
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <details className="space-y-3">
              <summary className="text-xs font-bold text-foreground cursor-pointer py-2">
                فیلترهای بیشتر
              </summary>
              <div className="space-y-3">
                {(
                  [
                    [
                      'category',
                      'دسته‌بندی',
                      input.categoryIds,
                      facets.categories,
                    ],
                    ['brands', 'برند', input.brandIds, facets.brands],
                    ['tags', 'برچسب‌ها', input.tagIds, facets.tags],
                  ] as const
                ).map(
                  ([key, label, ids, options]) =>
                    !!options.length && (
                      <FilterSelect
                        key={key}
                        label={label}
                        selected={ids.map(String)}
                        options={options.map((item) => ({
                          id: String(item.id),
                          label: item.name,
                        }))}
                        multiple
                        onChange={(values) =>
                          setCatalogSearch(key, values.join(','))
                        }
                      />
                    ),
                )}
                {!!facets.colors.length && (
                  <FilterSelect
                    label="رنگ"
                    selected={input.colors}
                    options={facets.colors.map((value) => ({
                      id: value,
                      label: value,
                    }))}
                    multiple
                    onChange={(values) =>
                      setCatalogSearch('colors', values.join(','))
                    }
                  />
                )}
                {config.showPrice && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['minPrice', 'maxPrice'] as const).map((key, i) => (
                      <label key={key} className="space-y-1 text-xs font-bold">
                        {i ? 'حداکثر' : 'حداقل'} قیمت (تومان)
                        <input
                          className="h-12 w-full bg-muted/5 rounded-2xl px-3 font-normal"
                          type="number"
                          min={0}
                          value={input[key] ?? ''}
                          onChange={(event) =>
                            setCatalogSearch(key, event.target.value)
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </details>
          </Drawer.Body>
          <Drawer.Footer className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-surface grid grid-cols-2 gap-3 shrink-0 border-t border-border/10">
            <Button
              type="button"
              onPress={reset}
              className="control-height-12 w-full px-4 bg-muted/10 hover:bg-muted/20 text-foreground text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <RestartIcon size={14} />
              <span>پاک کردن</span>
            </Button>
            <Button
              type="button"
              onPress={onClose}
              className="control-height-12 px-4 w-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              مشاهده نتایج ({toPersianDigits(page.total)})
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}
