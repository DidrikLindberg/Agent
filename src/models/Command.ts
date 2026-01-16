export type CommandType =
  | 'reply'
  | 'forward'
  | 'archive'
  | 'delete'
  | 'mark_read'
  | 'mark_unread'
  | 'star'
  | 'unstar'
  | 'label';

export interface BaseCommand {
  type: CommandType;
  targetRef: string; // EMAIL-XXX reference
  targetGmailId?: string; // Resolved Gmail message ID
}

export interface ReplyCommand extends BaseCommand {
  type: 'reply';
  content: string;
}

export interface ForwardCommand extends BaseCommand {
  type: 'forward';
  forwardTo: string;
  note?: string;
}

export interface ArchiveCommand extends BaseCommand {
  type: 'archive';
}

export interface DeleteCommand extends BaseCommand {
  type: 'delete';
}

export interface MarkReadCommand extends BaseCommand {
  type: 'mark_read';
}

export interface MarkUnreadCommand extends BaseCommand {
  type: 'mark_unread';
}

export interface StarCommand extends BaseCommand {
  type: 'star';
}

export interface UnstarCommand extends BaseCommand {
  type: 'unstar';
}

export interface LabelCommand extends BaseCommand {
  type: 'label';
  labelName: string;
}

export type Command =
  | ReplyCommand
  | ForwardCommand
  | ArchiveCommand
  | DeleteCommand
  | MarkReadCommand
  | MarkUnreadCommand
  | StarCommand
  | UnstarCommand
  | LabelCommand;

export interface CommandResult {
  command: Command;
  success: boolean;
  error?: string;
  details?: string;
}

export interface CommandBatch {
  commands: Command[];
  sourceMessageId: string;
  parsedAt: Date;
}

export function commandTypeToLabel(type: CommandType): string {
  const labels: Record<CommandType, string> = {
    reply: 'Replied to',
    forward: 'Forwarded',
    archive: 'Archived',
    delete: 'Deleted',
    mark_read: 'Marked as read',
    mark_unread: 'Marked as unread',
    star: 'Starred',
    unstar: 'Unstarred',
    label: 'Labeled',
  };
  return labels[type];
}
