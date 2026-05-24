import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical } from 'react-icons/fa';

export const SortableTask = ({ task }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`task-card ${task.status}`}>
      <div className="task-drag-handle" {...attributes} {...listeners}>
        <FaGripVertical />
      </div>
      <div className="task-content">
        <h4>{task.title}</h4>
        {task.description && <p>{task.description}</p>}
        <div className="task-meta">
          <span className={`priority-badge ${task.priority.toLowerCase()}`}>
            {task.priority}
          </span>
          {task.deadline && <span>📅 {task.deadline}</span>}
        </div>
      </div>
    </div>
  );
};