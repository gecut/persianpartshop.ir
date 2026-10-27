import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Modal as HeroUIModal,
  Drawer,
  Button,
  TextField,
  Label,
  Input,
} from "@heroui/react";
import { useAuth } from "../auth/auth-store";
import { toPersianDigits } from "../../lib/utils/currency";
import { toast } from "../../components/feedback/toast";
import {
  UserIcon,
  StoreIcon,
  PhoneIcon,
  LogOutIcon,
  AlertCircleIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  LockIcon,
} from "../../components/ui/icons";

export function ProfileView() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    storeName: user?.storeName || "",
    address: user?.address || "",
  });

  if (!user) {
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
          onPress={() => navigate({ to: "/login" })}
          className="w-full h-10 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer"
        >
          ورود به حساب کاربری
        </Button>
      </div>
    );
  }

  const handleStartEdit = () => {
    setFormData({
      name: user.name,
      storeName: user.storeName,
      address: user.address || "",
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData({
      name: user.name,
      storeName: user.storeName,
      address: user.address || "",
    });
    setIsEditing(false);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.warning("نام و نام خانوادگی الزامی است.");
      return;
    }

    if (!formData.storeName.trim()) {
      toast.warning("عنوان فروشگاه یا شرکت الزامی است.");
      return;
    }

    updateProfile({
      name: formData.name.trim(),
      storeName: formData.storeName.trim(),
      address: formData.address.trim(),
    });

    toast.success(
      "تغییرات ذخیره شد",
      "اطلاعات حساب کاربری با موفقیت به‌روزرسانی گردید.",
    );
    setIsEditing(false);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    toast.info("خروج از حساب", "از حساب کاربری خود خارج شدید.");
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-3.5 w-full">
      {/* Top Header Card */}
      <div className="bg-muted/5 rounded-2xl p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-foreground">
                {user.name}
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
              <StoreIcon size={12} className="text-muted shrink-0" />
              <span className="truncate max-w-50">{user.storeName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            onPress={() => setShowLogoutConfirm(true)}
            className="h-10 px-4 rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
            aria-label="خروج از حساب"
          >
            <LogOutIcon size={14} />
            <span>خروج</span>
          </Button>
        </div>
      </div>

      {/* Main View Cards */}
      <div className="space-y-2.5">
        <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <UserIcon size={17} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1 text-start">
            <span className="text-xs font-semibold text-muted block">
              نام نماینده / مدیر خرید
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {user.name}
            </span>
          </div>
        </div>

        <div className="bg-muted/5 rounded-2xl p-3.5 sm:p-4 flex items-start gap-3">
          <StoreIcon size={17} className="text-muted mt-0.5 shrink-0" />
          <div className="flex-1 text-start">
            <span className="text-xs font-semibold text-muted block">
              عنوان فروشگاه / شرکت حقوقی
            </span>
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {user.storeName}
            </span>
          </div>
        </div>

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
              {toPersianDigits(user.phone)}
            </span>
          </div>
        </div>

        {/* Quick Edit CTA Button */}
        <div className="pt-1">
          <Button
            type="button"
            onPress={handleStartEdit}
            className="h-12 w-full px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            <PencilIcon size={16} />
            <span>ویرایش اطلاعات</span>
          </Button>
        </div>
      </div>

      <Drawer>
        <Drawer.Backdrop
          isOpen={isEditing}
          onOpenChange={(open) => !open && handleCancelEdit()}
          className="fixed z-50 backdrop-blur-xs bg-foreground/30 min-h-60 flex items-end justify-center fade-up transition-all duration-300"
        >
          <Drawer.Content
            placement="bottom"
            className="w-full max-w-lg mx-auto fixed z-50 bottom-0! mb-0! inset-x-0 top-auto h-auto! max-h-[92dvh] rounded-t-3xl rounded-b-none! flex flex-col overflow-hidden border-b-0! shadow-2xl"
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
                  onClick={handleCancelEdit}
                  aria-label="بستن"
                  className="size-10 rounded-2xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors shrink-0"
                >
                  <XIcon />
                </Button>
              </Drawer.Header>

              {/* Form & Body */}
              <form
                onSubmit={handleSaveProfile}
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
                        {toPersianDigits(user.phone)}
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
                    onClick={handleCancelEdit}
                    className="h-12 px-4 rounded-2xl bg-muted/10 hover:bg-muted/15 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <XIcon size={15} />
                    <span>انصراف</span>
                  </Button>
                  <Button
                    type="submit"
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

      {/* HeroUI Logout Confirmation Modal */}
      <HeroUIModal.Root
        isOpen={showLogoutConfirm}
        onOpenChange={(open) => !open && setShowLogoutConfirm(false)}
      >
        <HeroUIModal.Backdrop
          isDismissable
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
        >
          <HeroUIModal.Container className="pointer-events-none w-full max-w-sm h-auto p-0 flex flex-col items-center">
            <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-center p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
                <LogOutIcon size={24} />
              </div>
              <div>
                <HeroUIModal.Heading className="text-base font-bold text-foreground">
                  خروج از حساب کاربری
                </HeroUIModal.Heading>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  آیا از خروج از حساب کاربری همکاران اطمینان دارید؟
                </p>
              </div>
              <div className="w-full flex items-center justify-center gap-1.5 pt-2">
                <Button
                  type="button"
                  onPress={() => setShowLogoutConfirm(false)}
                  className="h-12  px-4 w-full rounded-2xl bg-muted/10 text-foreground text-xs font-bold hover:bg-muted/15 cursor-pointer transition-all"
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  onPress={handleLogout}
                  className="h-12 px-4 w-full rounded-2xl bg-danger/15 text-danger hover:bg-danger/20 font-bold text-xs cursor-pointer transition-all"
                >
                  تأیید خروج
                </Button>
              </div>
            </HeroUIModal.Dialog>
          </HeroUIModal.Container>
        </HeroUIModal.Backdrop>
      </HeroUIModal.Root>
    </div>
  );
}
