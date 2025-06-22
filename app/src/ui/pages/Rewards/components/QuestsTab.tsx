import React from 'react';
import { Card, Button, StatusBadge } from '../../../components/common';
import type { Quest } from '../../../../shared/types';

interface QuestsTabProps {
  quests: Quest[];
  onRefresh: () => void;
}

const getQuestIcon = (questId: string) => {
  if (questId.includes('daily')) return '🌅';
  if (questId.includes('weekly')) return '⚡';
  return '🎯';
};

export function QuestsTab({ quests, onRefresh }: QuestsTabProps) {
  const dailyQuests = quests.filter(quest => quest.type === 'daily');
  const weeklyQuests = quests.filter(quest => quest.type === 'weekly');

  const getTimeUntilReset = (type: 'daily' | 'weekly') => {
    const now = new Date();
    if (type === 'daily') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } else {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
      nextWeek.setHours(0, 0, 0, 0);
      const diff = nextWeek.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return `${days}d ${hours}h`;
    }
  };

  const renderQuestCard = (quest: Quest) => (
    <Card key={quest.id} className={quest.isCompleted ? 'bg-green-50 border-green-200' : ''}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="text-3xl">{getQuestIcon(quest.id)}</div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">{quest.name}</h4>
            <p className="text-sm text-gray-600 mt-1">{quest.description}</p>
            <div className="mt-2">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{quest.progress} / {quest.maxProgress}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    quest.isCompleted ? 'bg-green-600' : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.min((quest.progress / quest.maxProgress) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-right space-y-2">
          <div className="text-lg font-bold text-blue-600">+{quest.reward.value}</div>
          <div className="text-xs text-gray-600">points</div>
          {quest.isCompleted ? (
            <StatusBadge 
              status="success" 
              label="Completed" 
              size="sm"
            />
          ) : (
            <StatusBadge 
              status="warning" 
              label="In Progress" 
              size="sm"
            />
          )}
          {quest.completedAt && (
            <div className="text-xs text-gray-500">
              {new Date(quest.completedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Daily & Weekly Quests</h3>
        <Button onClick={onRefresh} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      {/* Quest Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">
              {dailyQuests.filter(q => q.isCompleted).length} / {dailyQuests.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Daily Quests</div>
            <div className="text-xs text-gray-500 mt-2">
              Resets in {getTimeUntilReset('daily')}
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {weeklyQuests.filter(q => q.isCompleted).length} / {weeklyQuests.length}
            </div>
            <div className="text-sm text-gray-600 mt-1">Weekly Quests</div>
            <div className="text-xs text-gray-500 mt-2">
              Resets in {getTimeUntilReset('weekly')}
            </div>
          </div>
        </Card>
      </div>

      {/* Daily Quests */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <h4 className="text-lg font-medium text-gray-900">Daily Quests</h4>
          <span className="text-2xl">🌅</span>
        </div>
        
        {dailyQuests.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📅</div>
              <p>No daily quests available</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {dailyQuests.map(renderQuestCard)}
          </div>
        )}
      </div>

      {/* Weekly Quests */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <h4 className="text-lg font-medium text-gray-900">Weekly Quests</h4>
          <span className="text-2xl">⚡</span>
        </div>
        
        {weeklyQuests.length === 0 ? (
          <Card>
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📆</div>
              <p>No weekly quests available</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {weeklyQuests.map(renderQuestCard)}
          </div>
        )}
      </div>
    </div>
  );
} 