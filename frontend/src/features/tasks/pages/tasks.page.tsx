import { useState } from 'react';
import { format, parseISO, isPast } from 'date-fns';
import { Plus, LayoutGrid, List, AlertCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PATHS } from '@/routes/paths';
import { useTasks, useTaskStats, useDeleteTask } from '../hooks/use-tasks';
import { TaskBoard } from '../components/task-board';
import { TaskFormModal } from '../components/task-form-modal';
import type { Task, TaskStatus, TaskPriority } from '../types/tasks.types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types/tasks.types';

type View = 'board' | 'list';

export function TasksPage() {
  const [view, setView] = useState<View>('board');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [createStatus, setCreateStatus] = useState<TaskStatus>('todo');
  const [showCreate, setShowCreate] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const navigate = useNavigate();

  const { data: stats } = useTaskStats();
  const { data: taskData, isLoading, isError, refetch } = useTasks({
    ...(statusFilter && { status: statusFilter }),
    ...(priorityFilter && { priority: priorityFilter }),
    limit: 100,
  });
  const deleteTask = useDeleteTask();

  const tasks = taskData?.items ?? [];

  const openCreate = (status: TaskStatus = 'todo') => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage compliance tasks across your organization</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> New Task
        </button>
      </div>

      {/* Stat cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total" value={stats.total} color="text-slate-700" bg="bg-slate-50" />
          <StatCard label="In Progress" value={stats.in_progress} color="text-blue-700" bg="bg-blue-50" />
          <StatCard label="Completed" value={stats.completed} color="text-green-700" bg="bg-green-50" />
          <StatCard label="Overdue" value={stats.overdue} color="text-red-700" bg="bg-red-50" alert={stats.overdue > 0} />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          <button onClick={() => setView('board')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === 'board' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'}`}>
            <LayoutGrid className="h-3.5 w-3.5" /> Board
          </button>
          <button onClick={() => setView('list')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600'}`}>
            <List className="h-3.5 w-3.5" /> List
          </button>
        </div>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)} className="rounded-md border border-slate-300 px-2 py-1.5 text-xs">
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400">Loading…</div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Couldn't load tasks.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : view === 'board' ? (
        <TaskBoard
          tasks={tasks}
          onTaskClick={(t) => setEditTask(t)}
          onViewTask={(t) => navigate(PATHS.TASK_DETAIL(t.id))}
          onCreateTask={(status) => openCreate(status)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Task</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Priority</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Assignee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Due Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-400">No tasks found</td>
                </tr>
              ) : tasks.map((task) => {
                const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'completed' && task.status !== 'cancelled';
                const sCfg = STATUS_CONFIG[task.status];
                const pCfg = PRIORITY_CONFIG[task.priority];
                return (
                  <tr key={task.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={PATHS.TASK_DETAIL(task.id)} className="font-medium text-slate-900 hover:text-blue-600 text-sm">
                        {task.title}
                      </Link>
                      {(task.tags?.length ?? 0) > 0 && (
                        <div className="flex gap-1 mt-0.5">
                          {(task.tags ?? []).slice(0, 3).map((t) => (
                            <span key={t} className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{t}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sCfg.bgColor} ${sCfg.color}`}>
                        {sCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-2 w-2 rounded-full ${pCfg.dotColor}`} />
                        <span className={`text-xs font-medium ${pCfg.color}`}>{pCfg.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {task.assigneeName ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-xs ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                      {task.dueDate ? (
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertCircle className="h-3 w-3" />}
                          {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={PATHS.TASK_DETAIL(task.id)} className="text-xs text-blue-600 hover:underline">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white p-6 shadow-2xl w-80">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Delete Task?</h3>
            <p className="text-xs text-slate-600 mb-4">This will permanently delete the task and all its subtasks and comments.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
              <button
                onClick={async () => { await deleteTask.mutateAsync(deleteId); setDeleteId(null); }}
                disabled={deleteTask.isPending}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteTask.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <TaskFormModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        defaultStatus={createStatus}
      />
      {editTask && (
        <TaskFormModal
          open={true}
          onClose={() => setEditTask(null)}
          task={editTask}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color, bg, alert }: { label: string; value: number; color: string; bg: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-200 p-4 ${bg}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {alert && <AlertCircle className="h-4 w-4 text-red-500" />}
      </div>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
