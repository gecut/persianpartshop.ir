import { Modal as HeroUIModal, Button, TextField, Label, Input, Select, ListBox } from "@heroui/react"
import { CheckIcon, XIcon, FileTextIcon, RefreshCwIcon } from "@/components/ui/icons"
import { DOCUMENT_TYPE_OPTIONS, type DocumentTypeValue } from "./_document-types"
import { DocumentFilePicker } from "./_document-file-picker"
import type { ProfileDocumentUpload } from "./_use-profile-documents"

interface UploadDocumentModalProps {
  upload: ProfileDocumentUpload;
  isSubmitDisabled: boolean;
}

export function UploadDocumentModal({ upload, isSubmitDisabled }: UploadDocumentModalProps) {
  const {
    showUploadModal,
    handleCloseUploadModal,
    handleUploadDocument,
    uploadDocType,
    setUploadDocType,
    uploadTitle,
    setUploadTitle,
    uploadFile,
    uploadPreviewUrl,
    fileInputRef,
    handleFileChange,
    clearUploadFile,
    isUploading,
  } = upload;

  return (
<HeroUIModal.Root
            isOpen={showUploadModal}
            onOpenChange={(open) => !open && handleCloseUploadModal()}
          >
            <HeroUIModal.Backdrop
              isDismissable
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-backdrop-enter"
            >
              <HeroUIModal.Container className="pointer-events-none w-full max-w-md h-auto p-0 flex flex-col items-center">
                <HeroUIModal.Dialog className="pointer-events-auto relative w-full bg-surface rounded-2xl flex flex-col z-10 overflow-hidden animate-modal-enter text-start p-5 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between border-b border-border/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                        <FileTextIcon size={16} />
                      </span>
                      <HeroUIModal.Heading className="text-sm font-extrabold text-foreground">
                        آپلود مدارک
                      </HeroUIModal.Heading>
                    </div>
                    <Button
                      type="button"
                      onPress={handleCloseUploadModal}
                      className="size-8 rounded-xl bg-muted/10 hover:bg-muted/20 text-muted hover:text-foreground flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <XIcon size={16} />
                    </Button>
                  </div>

                  <form onSubmit={handleUploadDocument} className="space-y-4">
                {/* Document Type Selection (HeroUI Select Input) */}
                    <div className="space-y-1.5 text-start">
                      <Select
                        selectedKey={uploadDocType}
                        onSelectionChange={(key) => {
                          if (key)
                            setUploadDocType(String(key) as DocumentTypeValue);
                        }}
                        fullWidth
                        className="w-full text-start"
                        aria-label="نوع مدرک"
                      >
                        <Label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1">
                          <span>نوع مدرک</span>
                          <span className="text-danger text-[11px] font-bold">
                            الزامی
                          </span>
                        </Label>
                        <Select.Trigger className="w-full h-11 px-3.5 rounded-xl bg-muted/10 border border-border/20 text-foreground font-bold text-xs flex items-center justify-between cursor-pointer hover:bg-muted/15 transition-colors">
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover
                          dir="rtl"
                          className="w-[var(--trigger-width)] max-h-60 overflow-y-auto rounded-xl bg-surface border border-border/20 p-1.5 shadow-2xl z-60"
                        >
                          <ListBox dir="rtl">
                            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                              <ListBox.Item
                                key={opt.value}
                                id={opt.value}
                                textValue={opt.label}
                                className="px-3 py-2 text-xs font-bold rounded-lg cursor-pointer hover:bg-muted/15 flex items-center justify-between text-right"
                              >
                                <span>{opt.label}</span>
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                {/* Optional Custom Description */}
                    <TextField
                      name="documentTitle"
                      className="space-y-1 text-start"
                    >
                      <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                        <span>توضیحات تکمیلی مدرک</span>
                        <span className="text-muted font-normal">(اختیاری)</span>
                      </Label>
                      <Input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="مثال: پروانه کسب شعبه دوم، استعلام سال جاری و..."
                        className="w-full p-3 text-xs font-bold text-foreground bg-muted/10 rounded-xl outline-none"
                      />
                    </TextField>

                {/* File Upload Box */}
                <DocumentFilePicker
                  file={uploadFile}
                  previewUrl={uploadPreviewUrl}
                  inputRef={fileInputRef}
                  onChange={handleFileChange}
                  onClear={clearUploadFile}
                />

                {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/10">
                      <Button
                        type="button"
                        onPress={handleCloseUploadModal}
                        className="h-11 px-4 rounded-xl bg-muted/10 hover:bg-muted/15 text-foreground font-bold text-xs cursor-pointer flex-1"
                      >
                        انصراف
                      </Button>
                      <Button
                        type="submit"
                        isDisabled={!uploadFile || isUploading || isSubmitDisabled}
                        className="h-11 px-4 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs cursor-pointer flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isUploading ? (
                          <>
                            <RefreshCwIcon size={14} className="animate-spin" />
                            <span>در حال ارسال...</span>
                          </>
                        ) : (
                          <>
                            <CheckIcon size={15} />
                            <span>ارسال مدرک</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </HeroUIModal.Dialog>
              </HeroUIModal.Container>
            </HeroUIModal.Backdrop>
          </HeroUIModal.Root>
  );
}
