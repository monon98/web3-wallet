export type InlineEditableTextProps = {
  id: string;
  value: string;
  isEditing: boolean;
  draftValue: string;
  onDraftValueChange: (next: string) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: () => void | Promise<void>;
  maxLength?: number;
  className?: string;
};
