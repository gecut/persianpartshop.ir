import { DialogIntro } from './_dialog-intro'
import { InstallationSteps } from './_installation-steps'

export function AppleMobileInstallView() {
  return (
    <div className="space-y-3">
      <DialogIntro title="نصب روی آیفون و آیپد">
        این صفحه را در <bdi>Safari</bdi> باز کنید و پرشین‌پارت را به صفحهٔ اصلی اضافه کنید.
      </DialogIntro>
      <InstallationSteps>
        <li>دکمهٔ اشتراک‌گذاری را بزنید.</li>
        <li>«افزودن به صفحهٔ اصلی» را انتخاب کنید.</li>
        <li>اگر گزینهٔ <bdi>Open as Web App</bdi> را می‌بینید، آن را روشن کنید. سپس «افزودن» را بزنید.</li>
      </InstallationSteps>
    </div>
  )
}
