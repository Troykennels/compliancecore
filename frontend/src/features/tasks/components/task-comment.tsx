import React, { useState } from 'react';
import { Trash2, Lock } from 'lucide-react';
import type { TaskComment } from '../types/tasks.types';
import { useDeleteComment } from '../hooks/use-tasks';
import { useOrgFormat } from '@/lib/org-format';

interface TaskCommentProps {
  comment:    TaskComment;
  taskId:     string;
  canDelete:  boolean;
}

export function TaskCommentItem({ comment, taskId, canDelete }: TaskCommentProps) {
  const fmt = useOrgFormat();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteComment = useDeleteComment(taskId);

  const initials = comment.userName
    ? comment.userName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className={`flex gap-3 ${comment.isInternal ? 'opacity-80' : ''}`}>
      {/* Avatar */}
      <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 mt-0.5">
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-800">{comment.userName ?? 'Unknown'}</span>
          <span className="text-[11px] text-slate-400">
            {fmt.formatDateTimeMedium(comment.createdAt)}
          </span>
          {comment.editedAt && (
            <span className="text-[10px] text-slate-400 italic">(edited)</span>
          )}
          {comment.isInternal && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              <Lock className="h-2.5 w-2.5" /> Internal
            </span>
          )}
        </div>

        <div className={`rounded-xl px-4 py-3 text-sm text-slate-700 ${
          comment.isInternal ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100'
        }`}>
          {comment.body}
        </div>

        {canDelete && (
          <div className="mt-1">
            {confirmDelete ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Delete this comment?</span>
                <button
                  onClick={async () => {
                    await deleteComment.mutateAsync(comment.id);
                    setConfirmDelete(false);
                  }}
                  disabled={deleteComment.isPending}
                  className="text-red-600 font-semibold hover:underline"
                >
                  {deleteComment.isPending ? 'Deleting…' : 'Delete'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface AddCommentFormProps {
  taskId:     string;
  showInternal?: boolean;
}

export function AddCommentForm({ taskId, showInternal = false }: AddCommentFormProps) {
  const [content, setContent]       = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const addComment = useAddCommentHook(taskId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await addComment.mutateAsync({ content: content.trim(), isInternal });
    setContent('');
    setIsInternal(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        placeholder="Add a comment…"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400 resize-none"
      />
      <div className="flex items-center justify-between">
        {showInternal && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={isInternal} onChange={(e) => setIsInternal(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300" />
            <Lock className="h-3 w-3 text-amber-600" /> Internal note
          </label>
        )}
        <div className="ml-auto">
          <button
            type="submit"
            disabled={!content.trim() || addComment.isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {addComment.isPending ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </div>
    </form>
  );
}

// Re-export to avoid circular import
import { useAddComment as useAddCommentHook } from '../hooks/use-tasks';
