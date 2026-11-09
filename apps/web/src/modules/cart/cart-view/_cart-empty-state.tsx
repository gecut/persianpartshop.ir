import { Link } from '@tanstack/react-router'


import { ShoppingCartIcon } from '@/components/ui/icons'

export function CartEmptyState() {
  return (
      <div className="bg-muted/5 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-muted/10 text-muted flex items-center justify-center mx-auto">
          <ShoppingCartIcon size={28} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">
            سبد خرید خالی است
          </h3>
          <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
            برای مشاهده و انتخاب کالاها به لیست محصولات مراجعه کنید.
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2">
          <Link
            to="/product"
            className="w-full h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 active:scale-98 text-primary-foreground text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
          >
            مشاهده محصولات
          </Link>
        </div>
      </div>
  );
}
