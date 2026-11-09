import { useTextDraft } from '@/lib/drafts'
import { Drawer, Button, TextField, Label, Input } from "@heroui/react"
import { toPersianDigits } from "@/lib/utils/currency"
import { UserIcon, StoreIcon, PhoneIcon, PencilIcon, CheckIcon, XIcon, LockIcon } from "@/components/ui/icons"

export type ProfileFormData = {
  name: string;
  storeName: string;
  address: string;
};

interface EditProfileDrawerProps {
  isOpen: boolean;
  formData: ProfileFormData;
  setFormData: ReturnType<typeof useTextDraft<ProfileFormData>>[1];
  phone: string;
  isSaveDisabled: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function EditProfileDrawer({ isOpen, formData, setFormData, phone, isSaveDisabled, onCancel, onSubmit }: EditProfileDrawerProps) {
  return (
    <Drawer>
      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => !open && onCancel()}
        className="fixed z-50 backdrop-blur-xs bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
      >
        <Drawer.Content
          placement="bottom"
          className="w-full max-w-lg mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0!"
        >
          <Drawer.Dialog className="flex flex-col bg-background h-auto! max-h-[92dvh] min-h-0 outline-none text-start overscroll-contain m-0! mb-0! p-0! rounded-b-none!">
            {/* Drag Handle UI */}
            <div className="flex justify-center w-full shrink-0 pt-2 pb-1">
              <Drawer.Handle className="w-16 h-1.5 rounded-full" />
            </div>

            {/* Header */}
            <Drawer.Header className="w-full flex flex-row! items-center justify-between px-5 pt-2 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <PencilIcon size={16} />
                </span>
                <Drawer.Heading className="text-sm font-extrabold text-foreground">
                  ویرایش اطلاعات حساب کاربری
                </Drawer.Heading>
              </div>

              <Button
                type="button"
                onClick={onCancel}
                aria-label="بستن"
                className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <XIcon />
              </Button>
            </Drawer.Header>

            {/* Form & Body */}
            <form
              onSubmit={onSubmit}
              className="flex flex-col flex-1 min-h-0"
            >
              <Drawer.Body className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3 space-y-4 scrollbar-none">
                {/* Name Field */}
                <TextField
                  name="name"
                  isRequired
                  className="space-y-1 text-start"
                >
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <UserIcon size={15} className="text-muted" />
                    <span>نام و نام خانوادگی</span>
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    style={{ fontSize: "12px" }}
                    className="w-full p-4 text-xs! placeholder:text-xs! font-bold text-foreground bg-muted/10 rounded-2xl outline-none transition-all"
                    placeholder="مثال: آرش دهقان"
                  />
                </TextField>

                {/* Store Name Field */}
                <TextField
                  name="storeName"
                  isRequired
                  className="space-y-1 text-start"
                >
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-1">
                    <StoreIcon size={15} className="text-muted" />
                    <span>نام فروشگاه / شرکت</span>
                  </Label>
                  <Input
                    value={formData.storeName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        storeName: e.target.value,
                      }))
                    }
                    className="w-full p-4 text-xs! placeholder:text-xs! font-bold text-foreground bg-muted/10 rounded-2xl outline-none transition-all"
                    placeholder="مثال: بازرگانی پرشین پارت"
                  />
                </TextField>

                {/* Phone Number - Strictly Non-Editable */}
                <div className="space-y-1 text-start cursor-no-drop">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground flex items-center gap-1">
                      <PhoneIcon size={15} className="text-muted" />
                      <span>شماره همراه</span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-muted/10 rounded-2xl text-foreground select-none">
                    <span
                      className="text-xs! font-bold tracking-wider"
                      dir="ltr"
                    >
                      {toPersianDigits(phone)}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-muted w-fit rounded-lg">
                      <LockIcon size={16} className="text-muted" />
                    </span>
                  </div>
                </div>
              </Drawer.Body>

              {/* Footer Actions */}
              <Drawer.Footer className="px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] shrink-0 flex items-center gap-2 border-t border-border/20 bg-background">
                <Button
                  type="button"
                  onClick={onCancel}
                  className="h-12 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <XIcon size={15} />
                  <span>انصراف</span>
                </Button>
                <Button
                  type="submit" isDisabled={isSaveDisabled}
                  className="flex-1 h-12 px-4 rounded-2xl bg-success/15 text-success hover:bg-success/20 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                >
                  <CheckIcon size={15} />
                  <span>ذخیره تغییرات</span>
                </Button>
              </Drawer.Footer>
            </form>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
