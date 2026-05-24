import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableTask } from './SortableTask';

export const KanbanBoard = ({ tasks, onUpdateStatus, columns }) => {
  const [activeId, setActiveId] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    
    if (!over) return;
    
    const taskId = active.id;
    const newStatus = over.id;
    
    // Update task status
    onUpdateStatus(taskId, newStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="kanban-board">
        {columns.map((column) => (
          <div key={column.id} className="column">
            <div className={`column-header ${column.id}`}>
              <h2>{column.title}</h2>
              <span className="count">{tasks.filter(t => t.status === column.id).length}</span>
            </div>
            <SortableContext
              items={tasks.filter(t => t.status === column.id).map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="task-list">
                {tasks
                  .filter(t => t.status === column.id)
                  .map((task) => (
                    <SortableTask key={task.id} task={task} />
                  ))}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
      <DragOverlay>
        {activeId ? <div className="dragging-overlay">Moving Task...</div> : null}
      </DragOverlay>
    </DndContext>
  );
};