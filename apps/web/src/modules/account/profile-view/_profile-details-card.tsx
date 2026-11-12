import { Button } from "@heroui/react"
import { toPersianDigits } from "@/lib/utils/currency"
import { UserIcon, StoreIcon, PhoneIcon, PencilIcon } from "@/components/ui/icons"
import { ProfileInfoRow } from "./_profile-info-row"

interface ProfileDetailsCardProps {
  name: string;
  storeName: string;
  phone: string;
  onEdit: () => void;
}

export function ProfileDetailsCard({ name, storeName, phone, onEdit }: ProfileDetailsCardProps) {
  return (
    <div className="space-y-2.5">
      <ProfileInfoRow
        icon={<UserIcon size={17} className="text-muted mt-0.5 shrink-0" />}
        label="نام نماینده / مدیر خرید"
        value={name}
      />

      <ProfileInfoRow
        icon={<StoreIcon size={17} className="text-muted mt-0.5 shrink-0" />}
        label="عنوان فروشگاه / شرکت حقوقی"
        value={storeName}
      />

      <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start justify-start gap-3">
        <PhoneIcon size={17} className="text-muted mt-0.5 shrink-0" />
        <div className="flex-1 text-start">
          <div className="flex items-start justify-start">
            <span className="text-xs font-semibold text-muted block">
              شماره تلفن همراه
            </span>
          </div>
          <span
            className="text-xs sm:text-sm text-right font-bold text-foreground tracking-wider mt-0.5 block"
            dir="ltr"
          >
            {toPersianDigits(phone)}
          </span>
        </div>
      </div>

      {/* Quick Edit CTA Button */}
      <div className="pt-1">
        <Button
          type="button"
          onPress={onEdit}
          className="control-height-12 w-full px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
        >
          <PencilIcon size={16} />
          <span>ویرایش اطلاعات</span>
        </Button>
      </div>
    </div>
  );
}
