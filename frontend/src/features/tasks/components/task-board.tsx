import { format, parseISO, isPast } from 'date-fns';
import { Calendar, User, AlertCircle } from 'lucide-react';
import type { Task, TaskStatus } from '../types/tasks.types';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '../types/tasks.types';

const BOARD_COLUMNS: { status: TaskStatus; label: string; headerColor: string }[] = [
  { status: 'todo',        label: 'To Do',       headerColor: 'border-t-slate-400' },
  { status: 'in_progress', label: 'In Progress',  headerColor: 'border-t-blue-500' },
  { status: 'in_review',   label: 'In Review',    headerColor: 'border-t-purple-500' },
  { status: 'completed',   label: 'Completed',    headerColor: 'border-t-green-500' },
];

interface TaskBoardProps {
  tasks:         Task[];
  onTaskClick:   (task: Task) => void;
  onCreateTask?: (status: TaskStatus) => void;
}

export function TaskBoard({ tasks, onTaskClick, onCreateTask }: TaskBoardProps) {
  const grouped = BOARD_COLUMNS.reduce<Record<TaskStatus, Task[]>>((acc, col) => {
    acc[col.status] = tasks.filter((t) => t.status === col.status);
    return acc;
  }, {} as Record<TaskStatus, Task[]>);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((col) => (
        <BoardColumn
          key={col.status}
          col={col}
          tasks={grouped[col.status]}
          onTaskClick={onTaskClick}
          onCreateTask={onCreateTask}
        />
      ))}
    </div>
  );
}

function BoardColumn({
  col,
  tasks,
  onTaskClick,
  onCreateTask,
}: {
  col: { status: TaskStatus; label: string; headerColor: string };
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onCreateTask?: (status: TaskStatus) => void;
}) {
  const cfg = STATUS_CONFIG[col.status];

  return (
    <div className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 border-slate-200 bg-slate-50 ${col.headerColor}`}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{col.label}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cfg.bgColor} ${cfg.color}`}>{tasks.length}</span>
        </div>
        {onCreateTask && (
          <button
            onClick={() => onCreateTask(col.status)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 text-lg leading-none"
            title="Add task"
          >
            +
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-3">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center">
            <p className="text-xs text-slate-400">No tasks</p>
          </div>
        ) : (
          tasks.map((task) => (
            <BoardCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))
        )}
      </div>
    </div>
  );
}

function BoardCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const priCfg = PRIORITY_CONFIG[task.priority];
  const isOverdue = task.dueDate && isPast(parseISO(task.dueDate)) && task.status !== 'completed' && task.status !== 'cancelled';

  return (
    <div
      onClick={onClick}
      className="rounded-xl bg-white border border-slate-200 p-3.5 cursor-pointer hover:shadow-sm hover:border-blue-200 transition-all"
    >
      {/* Priority + tags */}
      <div className="flex items-start justify-between gap-1.5 mb-2">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${priCfg.dotColor}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${priCfg.color}`}>{priCfg.label}</span>
        </div>
        {isOverdue && (
          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
            <AlertCircle className="h-3 w-3" /> Overdue
          </span>
        )}
      </div>

      <p className="text-sm font-semibold text-slate-900 line-clamp-2 mb-2">{task.title}</p>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{tag}</span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[10px] text-slate-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Subtask progress */}
      {task.subtaskCount > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
            <span>{task.completedSubtasks}/{task.subtaskCount} subtasks</span>
          </div>
          <div className="h-1 w-full rounded-full bg-slate-100">
            <div
              className="h-1 rounded-full bg-blue-400"
              style={{ width: `${Math.round((task.completedSubtasks / task.subtaskCount) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between mt-1">
        {task.assigneeName && (
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[90px]">{task.assigneeName}</span>
          </div>
        )}
        {task.dueDate && (
          <div className={`flex items-center gap-1 text-[11px] ml-auto ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-400'}`}>
            <Calendar className="h-3 w-3" />
            {format(parseISO(task.dueDate), 'MMM d')}
          </div>
        )}
      </div>
    </div>
  );
}
