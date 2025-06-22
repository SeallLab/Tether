import React from 'react';
import { Card, StatusBadge } from '../../../components/common';
import type { Badge } from '../../../../shared/types';

interface BadgesTabProps {
  badges: Badge[];
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'common': return 'text-gray-600 bg-gray-100 border-gray-200';
    case 'rare': return 'text-blue-600 bg-blue-100 border-blue-200';
    case 'epic': return 'text-purple-600 bg-purple-100 border-purple-200';
    case 'legendary': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    default: return 'text-gray-600 bg-gray-100 border-gray-200';
  }
};

const getRarityGlow = (rarity: string) => {
  switch (rarity) {
    case 'rare': return 'shadow-blue-200 shadow-lg';
    case 'epic': return 'shadow-purple-200 shadow-lg';
    case 'legendary': return 'shadow-yellow-200 shadow-xl';
    default: return '';
  }
};

export function BadgesTab({ badges }: BadgesTabProps) {
  const unlockedBadges = badges.filter(badge => badge.earnedAt !== null);
  const lockedBadges = badges.filter(badge => badge.earnedAt === null);

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-xl font-semibold text-gray-900">Achievement Badges</h3>

      {/* Progress Summary */}
      <Card>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {unlockedBadges.length} / {badges.length}
          </div>
          <div className="text-sm text-gray-600 mt-1">Badges Earned</div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: badges.length > 0 ? `${(unlockedBadges.length / badges.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </Card>

      {/* Unlocked Badges */}
      {unlockedBadges.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4">Earned Badges</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlockedBadges.map((badge) => (
              <Card 
                key={badge.id} 
                className={`relative border-2 ${getRarityColor(badge.rarity)} ${getRarityGlow(badge.rarity)}`}
              >
                <div className="text-center space-y-3">
                  <div className="text-4xl">{badge.icon}</div>
                  <div>
                    <h5 className="font-medium text-gray-900">{badge.name}</h5>
                    <p className="text-sm text-gray-600 mt-1">{badge.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRarityColor(badge.rarity)}`}>
                      {badge.rarity}
                    </span>
                    <StatusBadge 
                      status="success" 
                      label="Unlocked" 
                      size="sm"
                    />
                  </div>

                  {badge.earnedAt && (
                    <div className="text-xs text-gray-500">
                      Earned {new Date(badge.earnedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Locked Badges */}
      {lockedBadges.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-4">Available Badges</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lockedBadges.map((badge) => (
              <Card 
                key={badge.id} 
                className="relative border-2 border-gray-200 opacity-75"
              >
                <div className="text-center space-y-3">
                  <div className="text-4xl grayscale">{badge.icon}</div>
                  <div>
                    <h5 className="font-medium text-gray-900">{badge.name}</h5>
                    <p className="text-sm text-gray-600 mt-1">{badge.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                      {badge.rarity}
                    </span>
                    <StatusBadge 
                      status="inactive" 
                      label="Locked" 
                      size="sm"
                    />
                  </div>

                  {/* Progress Bar */}
                  {badge.progress !== undefined && badge.maxProgress !== undefined && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Progress</span>
                          <span className="font-medium">{badge.progress} / {badge.maxProgress}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min((badge.progress / badge.maxProgress) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Badge Categories */}
      <Card title="Badge Categories">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['common', 'rare', 'epic', 'legendary'].map((rarity) => {
            const rarityBadges = badges.filter(badge => badge.rarity === rarity);
            const unlockedCount = rarityBadges.filter(badge => badge.earnedAt !== null).length;
            
            return (
              <div key={rarity} className="text-center">
                <div className={`w-8 h-8 rounded-full mx-auto mb-2 ${getRarityColor(rarity)}`} />
                <div className="capitalize font-medium text-gray-900">{rarity}</div>
                <div className="text-sm text-gray-600">
                  {unlockedCount} / {rarityBadges.length}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {badges.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🏆</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Badges Available</h3>
          <p className="text-gray-600">Start focusing to unlock your first achievement badges!</p>
        </div>
      )}
    </div>
  );
} 