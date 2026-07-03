import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO, isPast } from 'date-fns';
import { ArrowLeft, Edit2, Trash2, Plus, CheckSquare, Calendar, User, Tag, AlertCircle, RotateCcw } from 'lucide-react';
import { PATHS } from '@/routes/paths';
import { useTask, useSubtasks, useTaskComments, useUpdateTask, useDeleteTask } from '../hooks/use-tasks';
import { TaskFormModal } from '../components/task-form-modal';
import { TaskCommentItem, AddCommentForm } from '../components/task-comment';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types/tasks.types';
import type { Task } from '../types/tasks.types';

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: task, isLoading } = useTask(id!);
  const { data: subtasks = [] } = useSubtasks(id!);
  const { data: comments = [] } = useTaskComments(id!);
  const updateTask = useUpdateTask(id!);
  const deleteTask = useDeleteTask();

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-40 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-slate-500">Task not found.</p>
        <Link to={PATHS.TASKS} className="mt-2 text-sm text-blue-600 hover:underline">Back to Tasks</Link>
      </div>
    );
  }

  const sCfg = STATUS_CONFIG[task.status];
  const pCfg = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'completed' && task.status !== 'cancelled';

  const quickStatusChange = (status: Task['status']) => {
    updateTask.mutate({ status, ...(status === 'completed' ? {} : {}) });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <button onClick={() => navigate(PATHS.TASKS)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Tasks
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sCfg.bgColor} ${sCfg.color}`}>{sCfg.label}</span>
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${pCfg.dotColor}`} />
              <span className={`text-xs font-semibold ${pCfg.color}`}>{pCfg.label}</span>
            </div>
            {task.isRecurring && (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                <RotateCcw className="h-3 w-3" /> Recurring
              </span>
            )}
            {isOverdue && (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                <AlertCircle className="h-3 w-3" /> Overdue
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900">{task.title}</h1>
          {task.description && (
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{task.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowEdit(true)} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main content */}
        <div className="col-span-2 space-y-5">
          {/* Quick status */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Status Update</h3>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
                <button
                  key={status}
                  onClick={() => quickStatusChange(status as Task['status'])}
                  disabled={task.status === status || updateTask.isPending}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:cursor-default ${
                    task.status === status
                      ? `${cfg.bgColor} ${cfg.color} ring-2 ring-offset-1 ring-blue-400`
                      : `${cfg.bgColor} ${cfg.color} opacity-60 hover:opacity-100`
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">
                Subtasks <span className="text-slate-400 font-normal">({task.completedSubtasks}/{task.subtaskCount})</span>
              </h3>
              <button
                onClick={() => setShowAddSubtask(true)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-3.5 w-3.5" /> Add Subtask
              </button>
            </div>

            {subtasks.length === 0 ? (
              <p className="text-xs text-slate-400">No subtasks yet.</p>
            ) : (
              <div className="space-y-2">
                {subtasks.map((sub) => {
                  const subS = STATUS_CONFIG[sub.status];
                  return (
                    <div key={sub.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                      <CheckSquare className={`h-4 w-4 shrink-0 ${sub.status === 'completed' ? 'text-green-500' : 'text-slate-300'}`} />
                      <Link to={PATHS.TASK_DETAIL(sub.id)} className="flex-1 text-sm text-slate-700 hover:text-blue-600 truncate">
                        {sub.title}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${subS.bgColor} ${subS.color}`}>
                        {subS.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {task.subtaskCount > 0 && (
              <div className="mt-3">
                <div className="h-1.5 w-full rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.round((task.completedSubtasks / task.subtaskCount) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">
              Comments <span className="text-slate-400 font-normal">({comments.length})</span>
            </h3>
            <div className="space-y-4 mb-4">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400">No comments yet. Be the first to comment.</p>
              ) : (
                comments.map((c) => (
                  <TaskCommentItem key={c.id} comment={c} taskId={id!} canDelete={true} />
                ))
              )}
            </div>
            <AddCommentForm taskId={id!} showInternal={true} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Details</h3>
            <dl className="space-y-3">
              {task.assigneeName && (
                <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Assignee">
                  <span className="text-xs text-slate-800 font-medium">{task.assigneeName}</span>
                  {task.assigneeEmail && <p className="text-[11px] text-slate-400">{task.assigneeEmail}</p>}
                </MetaRow>
              )}
              {task.dueDate && (
                <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Due Date">
                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-slate-800'}`}>
                    {format(parseISO(task.dueDate), 'MMM d, yyyy h:mm a')}
                  </span>
                </MetaRow>
              )}
              {task.createdByName && (
                <MetaRow icon={<User className="h-3.5 w-3.5" />} label="Created By">
                  <span className="text-xs text-slate-800">{task.createdByName}</span>
                </MetaRow>
              )}
              <MetaRow icon={<Calendar className="h-3.5 w-3.5" />} label="Created">
                <span className="text-xs text-slate-600">{format(parseISO(task.createdAt), 'MMM d, yyyy')}</span>
              </MetaRow>
              {task.entityType && (
                <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Linked To">
                  <span className="text-xs text-slate-600 capitalize">{task.entityType}</span>
                </MetaRow>
              )}
            </dl>
          </div>

          {task.tags.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {task.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {task.isRecurring && task.recurrenceRule && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <h3 className="text-xs font-semibold text-blue-700 mb-1">Recurrence</h3>
              <p className="text-xs text-blue-600 font-mono">{task.recurrenceRule}</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-80">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Delete Task?</h3>
            <p className="text-xs text-slate-600 mb-4">All subtasks and comments will also be deleted. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                onClick={async () => {
                  await deleteTask.mutateAsync(task.id);
                  navigate(PATHS.TASKS);
                }}
                disabled={deleteTask.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteTask.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskFormModal open={showEdit} onClose={() => setShowEdit(false)} task={task} />
      <TaskFormModal open={showAddSubtask} onClose={() => setShowAddSubtask(false)} parentTaskId={id} />
    </div>
  );
}

function MetaRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">
        {icon} {label}
      </dt>
      <dd className="pl-5">{children}</dd>
    </div>
  );
}
