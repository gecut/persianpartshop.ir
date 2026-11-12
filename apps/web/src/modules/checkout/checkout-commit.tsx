import { SlideCommit, type SlideCommitProps } from '@/components/ui/slide-commit/slide-commit'

type CheckoutCommitProps = Pick<SlideCommitProps, 'label' | 'doneLabel' | 'errorLabel' | 'disabled' | 'onConfirm'>

export function CheckoutCommit(props: CheckoutCommitProps) {
  return <SlideCommit
    {...props}
    height={48}
    radius={20}
    className="w-full h-12! border-none! shadow-none! [box-shadow:none]!"
  />
}
