import { DialogIntro } from './_dialog-intro'
import { InstallationSteps } from './_installation-steps'

export function ManualInstallView() {
  return (
    <div className="space-y-3">
      <DialogIntro title="نصب از منوی مرورگر">
        پرشین‌پارت را در <bdi>Chrome</bdi> یا <bdi>Edge</bdi> باز کنید.
      </DialogIntro>
      <InstallationSteps>
        <li>منوی مرورگر را باز کنید.</li>
        <li>گزینهٔ «نصب برنامه» را انتخاب و نصب را تأیید کنید.</li>
      </InstallationSteps>
      <p className="text-xs leading-5 text-muted">
        در <bdi>Chrome</bdi> اندروید، ممکن است این گزینه در منوی «افزودن به صفحهٔ اصلی» باشد.
      </p>
    </div>
  )
}
