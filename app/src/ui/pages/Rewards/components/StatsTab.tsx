import React from 'react';
import { Card, Button } from '../../../components/common';
import type { GamificationData } from '../../../../shared/types';

interface StatsTabProps {
  data: GamificationData;
  onRefresh: () => void;
}

export function StatsTab({ data, onRefresh }: StatsTabProps) {
  const progressToNextLevel = ((data.totalPointsEarned % 100) / 100) * 100;
  const unlockedBadges = data.badges.filter(badge => badge.earnedAt !== null);
  const completedQuests = data.quests.filter(quest => quest.isCompleted);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">Progress Overview</h3>
        <Button onClick={onRefresh} variant="secondary" size="sm">
          Refresh
        </Button>
      </div>

      {/* Level Progress */}
      <Card title="Level Progress">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-600">Level {data.level}</div>
              <div className="text-sm text-gray-600">
                {data.totalPointsEarned % 100}/100 points to next level
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{data.points}</div>
              <div className="text-sm text-gray-600">Available Points</div>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressToNextLevel}%` }}
            />
          </div>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">{data.totalPointsEarned}</div>
            <div className="text-sm text-gray-600 mt-1">Total Points Earned</div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">{unlockedBadges.length}</div>
            <div className="text-sm text-gray-600 mt-1">Badges Earned</div>
          </div>
        </Card>

        <Card>
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-600">{data.unlockedThemes.length}</div>
            <div className="text-sm text-gray-600 mt-1">Themes Unlocked</div>
          </div>
        </Card>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Daily Streak">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🔥</div>
            <div>
              <div className="text-2xl font-bold text-red-600">{data.streaks.dailyFocus}</div>
              <div className="text-sm text-gray-600">consecutive hours today</div>
            </div>
          </div>
        </Card>

        <Card title="Weekly Streak">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">⚡</div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{data.streaks.weeklyFocus}</div>
              <div className="text-sm text-gray-600">hours this week</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Achievements */}
      <Card title="Recent Achievements">
        {data.achievements.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎯</div>
            <p>Start focusing to earn your first achievements!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.achievements.slice(-5).reverse().map((achievement, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="text-lg">🏆</div>
                  <div>
                    <div className="font-medium text-gray-900">{achievement.name}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(achievement.earnedAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium text-blue-600">
                  +{achievement.pointsAwarded} points
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
} 