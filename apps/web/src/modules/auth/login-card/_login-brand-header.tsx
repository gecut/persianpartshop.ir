
export function LoginBrandHeader() {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 p-2.5 overflow-hidden">
        <img
          src="/assets/images/persian-part-logo.png"
          alt="پرشین‌پارت"
          className="size-full object-contain"
        />
      </div>
      <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
        ورود به پرشین‌پارت
      </h1>
    </div>
  );
}
