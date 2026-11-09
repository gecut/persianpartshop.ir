import { Button } from "@heroui/react"
import { AlertCircleIcon } from "@/components/ui/icons"

interface SignedOutCardProps {
  onLogin: () => void;
}

export function SignedOutCard({ onLogin }: SignedOutCardProps) {
  return (
    <div className="bg-muted/5 rounded-2xl p-8 text-center max-w-md mx-auto my-12">
      <AlertCircleIcon size={36} className="text-muted mx-auto mb-3" />
      <h3 className="text-base font-bold text-foreground">
        حساب کاربری یافت نشد
      </h3>
      <p className="text-xs text-muted mt-1 mb-5">
        جهت مشاهده حساب کاربری لطفاً وارد سامانه شوید.
      </p>
      <Button
        type="button"
        onPress={onLogin}
        className="w-full h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer"
      >
        ورود به حساب کاربری
      </Button>
    </div>
  );
}
