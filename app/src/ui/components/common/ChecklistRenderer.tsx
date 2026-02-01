import React, { useState, useEffect } from 'react';
import { ChecklistItem, Checklist } from '../../../shared/types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChecklistRendererProps {
  content: string;
  messageId: string;
  sessionId: string;
  onChecklistUpdate?: (checklist: Checklist) => void;
}

export const ChecklistRenderer: React.FC<ChecklistRendererProps> = ({
  content,
  messageId,
  sessionId,
  onChecklistUpdate
}) => {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasChecklist, setHasChecklist] = useState(false);

  useEffect(() => {
    parseAndLoadChecklist();
  }, [content, messageId, sessionId]);

  const parseAndLoadChecklist = async () => {
    // Parse markdown content for checklist items
    const checklistItems = parseMarkdownChecklist(content);
    
    if (checklistItems.length > 0) {
      setHasChecklist(true);
      
      // Try to load existing checklist from backend
      try {
        const result = await window.electron?.chat?.getChecklist(sessionId, messageId);
        
        if (result?.success && result.data && result.data.length > 0) {
          // Use backend data if available
          setChecklist(result.data);
        } else {
          // Save new checklist to backend
          const newItems = checklistItems.map((item, idx) => ({
            id: '',
            taskText: item.text,
            isCompleted: item.completed,
            position: idx
          }));
          
          await saveChecklistToBackend(newItems);
          
          // Reload from backend to get IDs
          const reloadResult = await window.electron?.chat?.getChecklist(sessionId, messageId);
          if (reloadResult?.success && reloadResult.data) {
            setChecklist(reloadResult.data);
          } else {
            setChecklist(newItems);
          }
        }
      } catch (error) {
        console.error('Error loading checklist:', error);
        // Fallback to parsed items
        setChecklist(checklistItems.map((item, idx) => ({
          id: `temp-${idx}`,
          taskText: item.text,
          isCompleted: item.completed,
          position: idx
        })));
      }
    }
  };

  const parseMarkdownChecklist = (markdown: string): Array<{ text: string; completed: boolean }> => {
    const lines = markdown.split('\n');
    const items: Array<{ text: string; completed: boolean }> = [];
    
    for (const line of lines) {
      // Match markdown checklist format: - [ ] or - [x] or - [X]
      const uncheckedMatch = line.match(/^[-*]\s+\[\s\]\s+(.+)$/);
      const checkedMatch = line.match(/^[-*]\s+\[[xX]\]\s+(.+)$/);
      
      if (uncheckedMatch) {
        items.push({ text: uncheckedMatch[1].trim(), completed: false });
      } else if (checkedMatch) {
        items.push({ text: checkedMatch[1].trim(), completed: true });
      }
    }
    
    return items;
  };

  const saveChecklistToBackend = async (items: ChecklistItem[]) => {
    try {
      const tasks = items.map(item => ({
        task_text: item.taskText,
        is_completed: item.isCompleted,
        position: item.position
      }));
      
      await window.electron?.chat?.saveChecklist(sessionId, messageId, tasks);
    } catch (error) {
      console.error('Error saving checklist:', error);
    }
  };

  const handleToggle = async (item: ChecklistItem) => {
    setLoading(true);
    
    try {
      const newCompletedState = !item.isCompleted;
      
      // Update backend
      const result = await window.electron?.chat?.updateChecklistItem(
        sessionId,
        messageId,
        item.id,
        newCompletedState
      );
      
      if (result?.success) {
        // Update local state
        const updatedChecklist = checklist.map(i =>
          i.id === item.id ? { ...i, isCompleted: newCompletedState } : i
        );
        setChecklist(updatedChecklist);
        
        // Notify parent
        if (onChecklistUpdate) {
          onChecklistUpdate({
            messageId,
            sessionId,
            items: updatedChecklist
          });
        }
      }
    } catch (error) {
      console.error('Error updating checklist item:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgress = () => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.isCompleted).length;
    return Math.round((completed / checklist.length) * 100);
  };

  if (!hasChecklist) {
    // Render normal markdown if no checklist detected
    return <MarkdownRenderer content={content} className="text-white text-sm leading-relaxed" />;
  }

  const nonChecklistContent = removeChecklistFromMarkdown(content);
  const progress = getProgress();

  return (
    <div className="space-y-3">
      {/* Non-checklist content */}
      {nonChecklistContent && (
        <MarkdownRenderer content={nonChecklistContent} className="text-white text-sm leading-relaxed" />
      )}
      
      {/* Progress bar */}
      {checklist.length > 0 && (
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">Progress</span>
            <span className="text-xs font-medium text-blue-400">{progress}%</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Checklist items */}
      <div className="space-y-2">
        {checklist.map((item, index) => (
          <div
            key={item.id || index}
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 ${
              item.isCompleted
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <button
              onClick={() => handleToggle(item)}
              disabled={loading}
              className="flex-shrink-0 mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                  item.isCompleted
                    ? 'bg-green-500 border-green-500'
                    : 'border-white/30 hover:border-blue-400'
                }`}
              >
                {item.isCompleted && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
            </button>
            
            <div className="flex-1 min-w-0">
              <MarkdownRenderer
                content={item.taskText}
                className={`text-sm transition-all duration-200 ${
                  item.isCompleted
                    ? 'text-slate-400 line-through'
                    : 'text-white'
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Completion message */}
      {progress === 100 && (
        <div className="mt-4 p-3 bg-gradient-to-r from-green-500/20 to-blue-500/20 border border-green-500/30 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-white font-medium">
              Great job! You've completed all tasks
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

function removeChecklistFromMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const nonChecklistLines = lines.filter(line => {
    return !line.match(/^[-*]\s+\[[xX\s]\]/);
  });
  return nonChecklistLines.join('\n').trim();
}
