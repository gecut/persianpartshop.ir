import { DialogIntro } from './_dialog-intro'
import { InstallationSteps } from './_installation-steps'

export function MacSafariInstallView() {
  return (
    <div className="space-y-3">
      <DialogIntro title="نصب روی مک">
        برای دسترسی مستقیم، پرشین‌پارت را از <bdi>Safari</bdi> به داک اضافه کنید.
      </DialogIntro>
      <InstallationSteps>
        <li>منوی <bdi>File</bdi> را باز کنید.</li>
        <li>گزینهٔ <bdi>Add to Dock</bdi> را انتخاب کنید و افزودن را تأیید کنید.</li>
      </InstallationSteps>
    </div>
  )
}
