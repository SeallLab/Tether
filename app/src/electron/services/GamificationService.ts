import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { 
  GamificationData, 
  Badge, 
  Quest, 
  Achievement, 
  DockTheme, 
  PointEarningEvent,
  QuestReward
} from '../../shared/types.js';
import { Logger } from '../utils/Logger.js';
import { injectable } from 'tsyringe';

const DOCK_THEMES: DockTheme[] = [
  {
    id: 'default',
    name: 'Ocean Blue',
    description: 'The classic Tether blue theme',
    previewColor: '#243962',
    backgroundColor: 'rgba(36, 57, 98, 0.4)',
    unlockCost: 0,
    rarity: 'common'
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'A calming green for nature lovers',
    previewColor: '#2d5016',
    backgroundColor: 'rgba(45, 80, 22, 0.4)',
    unlockCost: 10,
    rarity: 'common'
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm orange tones for creative minds',
    previewColor: '#cc6600',
    backgroundColor: 'rgba(204, 102, 0, 0.4)',
    unlockCost: 25,
    rarity: 'rare'
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Elegant purple for productive kings and queens',
    previewColor: '#6a0dad',
    backgroundColor: 'rgba(106, 13, 173, 0.4)',
    unlockCost: 50,
    rarity: 'rare'
  },
  {
    id: 'crimson',
    name: 'Crimson Fire',
    description: 'Bold red for passionate workers',
    previewColor: '#dc143c',
    backgroundColor: 'rgba(220, 20, 60, 0.4)',
    unlockCost: 75,
    rarity: 'epic'
  },
  {
    id: 'galaxy',
    name: 'Galaxy Dreams',
    description: 'A mystical gradient for the cosmos explorer',
    previewColor: '#4b0082',
    backgroundColor: 'rgba(75, 0, 130, 0.4)',
    gradient: {
      from: '#4b0082',
      to: '#9400d3',
      direction: '45deg'
    },
    unlockCost: 150,
    rarity: 'epic'
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    description: 'The legendary northern lights theme',
    previewColor: '#00ff88',
    backgroundColor: 'rgba(0, 255, 136, 0.3)',
    gradient: {
      from: '#00ff88',
      to: '#0088ff',
      direction: '120deg'
    },
    special: {
      animated: true,
      shimmer: true
    },
    unlockCost: 300,
    rarity: 'legendary'
  }
];

const DEFAULT_BADGES: Badge[] = [
  {
    id: 'first_time_explorer',
    name: 'First Time Explorer',
    description: 'Open the settings page for the first time',
    icon: '🔍',
    rarity: 'common',
    earnedAt: null,
    maxProgress: 1
  },
  {
    id: 'first_focus',
    name: 'First Steps',
    description: 'Complete your first 60-minute focus session',
    icon: '🎯',
    rarity: 'common',
    earnedAt: null,
    maxProgress: 1
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Start a focus session before 8 AM',
    icon: '🌅',
    rarity: 'rare',
    earnedAt: null,
    maxProgress: 1
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Focus for 2+ hours after 9 PM',
    icon: '🦉',
    rarity: 'rare',
    earnedAt: null,
    maxProgress: 120
  },
  {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    description: 'Complete a 4-hour focus session',
    icon: '🏃‍♂️',
    rarity: 'epic',
    earnedAt: null,
    maxProgress: 240
  },
    {
    id: 'quick_recovery',
    name: 'Quick Recovery',
    description: 'Recover from a 10-minute break',
    icon: '🏃‍♂️',
    rarity: 'rare',
    earnedAt: null,
    maxProgress: 10
  },
  {
    id: 'zen_master',
    name: 'Zen Master',
    description: 'Accumulate 100 total focus hours',
    icon: '🧘‍♂️',
    rarity: 'legendary',
    earnedAt: null,
    maxProgress: 6000
  }
];

const DEFAULT_QUESTS: Quest[] = [
  {
    id: 'daily_focus',
    name: 'Daily Focus',
    description: 'Complete 2 hours of focused work today',
    type: 'daily',
    progress: 0,
    maxProgress: 120,
    reward: {
      type: 'points',
      value: 5,
      description: '5 bonus points'
    },
    isCompleted: false,
    completedAt: null,
    expiresAt: null
  },
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Complete 20 hours of focused work this week',
    type: 'weekly',
    progress: 0,
    maxProgress: 1200,
    reward: {
      type: 'points',
      value: 25,
      description: '25 bonus points'
    },
    isCompleted: false,
    completedAt: null,
    expiresAt: null
  }
];

const DEFAULT_GAMIFICATION_DATA: GamificationData = {
  points: 0,
  level: 1,
  totalPointsEarned: 0,
  currentDockTheme: 'default',
  unlockedThemes: ['default'],
  badges: DEFAULT_BADGES.map(badge => ({ ...badge, progress: 0 })),
  quests: DEFAULT_QUESTS,
  lastPointsEarned: 0,
  lastActivityTime: Date.now(),
  streaks: {
    dailyFocus: 0,
    weeklyFocus: 0,
    longestStreak: 0
  },
  achievements: []
};

@injectable()
export class GamificationService {
  private data: GamificationData;
  private dataPath: string;
  private isLoaded: boolean = false;
  private logger: Logger;
  constructor() {
    this.logger = new Logger({ name: 'GamificationService' });
    const userDataPath = app.getPath('userData');
    this.dataPath = path.join(userDataPath, 'gamification.json');
    this.data = { ...DEFAULT_GAMIFICATION_DATA };
  }

  /**
   * Load gamification data from disk
   */
  async load(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      try {
        await fs.access(this.dataPath);
      } catch {
        await this.save();
        this.isLoaded = true;
        this.logger.info('Created new gamification file with defaults');
        return;
      }

      const dataString = await fs.readFile(this.dataPath, 'utf8');
      const loadedData = JSON.parse(dataString) as Partial<GamificationData>;

      this.data = this.mergeWithDefaults(loadedData);
      await this.validateAndMigrate();
      
      this.isLoaded = true;
      this.logger.info('Gamification data loaded successfully');
    } catch (error) {
      this.logger.error('Error loading data:', error);
      this.data = { ...DEFAULT_GAMIFICATION_DATA };
      this.isLoaded = true;
    }
  }

  /**
   * Save gamification data to disk
   */
  async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(
        this.dataPath,
        JSON.stringify(this.data, null, 2),
        'utf8'
      );
      this.logger.info('Data saved successfully');
    } catch (error) {
      this.logger.error('Error saving data:', error);
      throw error;
    }
  }

  /**
   * Check if gamification data is loaded
   */
  isDataLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get all gamification data
   */
  getData(): GamificationData {
    if (!this.isLoaded) {
      throw new Error('Gamification data not loaded. Call load() first.');
    }
    return { ...this.data };
  }

  /**
   * Award points for focus sessions
   */
  async awardPoints(
    points: number, 
    type: PointEarningEvent['type'], 
    description: string,
    metadata?: Record<string, any>
  ): Promise<PointEarningEvent> {
    const event: PointEarningEvent = {
      id: uuidv4(),
      type,
      points,
      description,
      timestamp: Date.now(),
      metadata
    };

    this.data.points += points;
    this.data.totalPointsEarned += points;
    this.data.lastPointsEarned = points;
    
    // Update level (every 100 points = 1 level)
    this.data.level = Math.floor(this.data.totalPointsEarned / 100) + 1;

    // Create achievement
    const achievement: Achievement = {
      id: event.id,
      name: description,
      description: `Earned ${points} points for ${description.toLowerCase()}`,
      pointsAwarded: points,
      earnedAt: Date.now(),
      trigger: type,
      metadata
    };

    this.data.achievements.unshift(achievement);
    
    // Keep only last 100 achievements
    if (this.data.achievements.length > 100) {
      this.data.achievements = this.data.achievements.slice(0, 100);
    }

    await this.save();
    this.logger.info(`Awarded ${points} points for ${description}`);
    
    return event;
  }

  /**
   * Check and update focus streaks
   */
  async updateFocusStreaks(sessionDurationMinutes: number): Promise<void> {
    const now = new Date();
    const lastActivity = new Date(this.data.lastActivityTime);
    
    // Check if this is within the same day
    const isSameDay = now.toDateString() === lastActivity.toDateString();
    
    if (isSameDay) {
      this.data.streaks.dailyFocus += sessionDurationMinutes;
    } else {
      // Reset daily streak for new day
      this.data.streaks.dailyFocus = sessionDurationMinutes;
    }

    // Check if this is within the same week
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const lastWeekStart = new Date(lastActivity);
    lastWeekStart.setDate(lastActivity.getDate() - lastActivity.getDay());
    
    if (weekStart.getTime() === lastWeekStart.getTime()) {
      this.data.streaks.weeklyFocus += sessionDurationMinutes;
    } else {
      this.data.streaks.weeklyFocus = sessionDurationMinutes;
    }

    // Update longest streak
    if (this.data.streaks.dailyFocus > this.data.streaks.longestStreak) {
      this.data.streaks.longestStreak = this.data.streaks.dailyFocus;
    }

    this.data.lastActivityTime = Date.now();
    await this.save();
  }

  /**
   * Update quest progress
   */
  async updateQuestProgress(sessionDurationMinutes: number): Promise<Quest[]> {
    const completedQuests: Quest[] = [];
    const now = Date.now();

    for (const quest of this.data.quests) {
      if (quest.isCompleted) continue;

      // Check if quest is expired
      if (quest.expiresAt && now > quest.expiresAt) {
        continue;
      }

      let progressIncrement = 0;

      switch (quest.id) {
        case 'daily_focus':
          const today = new Date().toDateString();
          const questDate = quest.expiresAt ? new Date(quest.expiresAt - 24 * 60 * 60 * 1000).toDateString() : today;
          
          if (today !== questDate) {
            quest.progress = 0;
            quest.expiresAt = new Date().setHours(23, 59, 59, 999);
          }
          
          progressIncrement = sessionDurationMinutes;
          break;

        case 'weekly_warrior':
          progressIncrement = sessionDurationMinutes;
          break;
      }

      quest.progress += progressIncrement;

      if (quest.progress >= quest.maxProgress && !quest.isCompleted) {
        quest.isCompleted = true;
        quest.completedAt = now;
        completedQuests.push(quest);

        // Award quest rewards
        if (quest.reward.type === 'points') {
          await this.awardPoints(
            quest.reward.value as number,
            'quest_completion',
            `Completed quest: ${quest.name}`,
            { questId: quest.id }
          );
        }
      }
    }

    if (completedQuests.length > 0) {
      await this.save();
    }

    return completedQuests;
  }

  /**
   * Update badge progress and check for new badges
   */
  async updateBadgeProgress(sessionDurationMinutes: number, sessionStartHour: number): Promise<Badge[]> {
    const earnedBadges: Badge[] = [];

    for (const badge of this.data.badges) {
      if (badge.earnedAt) continue; // Already earned

      let progressIncrement = 0;

      switch (badge.id) {
        case 'first_focus':
          if (sessionDurationMinutes >= 60) {
            progressIncrement = 1;
          }
          break;

        case 'early_bird':
          if (sessionStartHour < 8 && sessionDurationMinutes >= 60) {
            progressIncrement = 1;
          }
          break;

        case 'night_owl':
          if (sessionStartHour >= 21) {
            progressIncrement = sessionDurationMinutes;
          }
          break;

        case 'marathon_runner':
          if (sessionDurationMinutes >= 240) {
            progressIncrement = 1;
          }
          break;

        case 'zen_master':
          progressIncrement = sessionDurationMinutes;
          break;
      }

      if (progressIncrement > 0) {
        badge.progress = (badge.progress || 0) + progressIncrement;

        if (badge.progress >= (badge.maxProgress || 1)) {
          badge.earnedAt = Date.now();
          earnedBadges.push(badge);
        }
      }
    }

    if (earnedBadges.length > 0) {
      await this.save();
    }

    return earnedBadges;
  }

  /**
   * Unlock a dock theme
   */
  async unlockTheme(themeId: string): Promise<boolean> {
    const theme = DOCK_THEMES.find(t => t.id === themeId);
    if (!theme) return false;

    if (this.data.points < theme.unlockCost) return false;
    if (this.data.unlockedThemes.includes(themeId)) return false;

    this.data.points -= theme.unlockCost;
    this.data.unlockedThemes.push(themeId);
    
    await this.save();
    return true;
  }

  /**
   * Set current dock theme
   */
  async setDockTheme(themeId: string): Promise<boolean> {
    if (!this.data.unlockedThemes.includes(themeId)) return false;

    this.data.currentDockTheme = themeId;
    await this.save();
    return true;
  }

  /**
   * Get all available themes with unlock status
   */
  getThemes(): (DockTheme & { isUnlocked: boolean; canAfford: boolean })[] {
    return DOCK_THEMES.map(theme => ({
      ...theme,
      isUnlocked: this.data.unlockedThemes.includes(theme.id),
      canAfford: this.data.points >= theme.unlockCost
    }));
  }

  /**
   * Get current theme data
   */
  getCurrentTheme(): DockTheme | null {
    return DOCK_THEMES.find(t => t.id === this.data.currentDockTheme) || null;
  }

  /**
   * Check and award the "First Time Explorer" badge for opening settings
   */
  async checkFirstTimeSettingsOpen(): Promise<Badge | null> {
    const badge = this.data.badges.find(b => b.id === 'first_time_explorer');
    
    if (!badge || badge.earnedAt) {
      return null; // Badge doesn't exist or already earned
    }

    // Award the badge
    badge.earnedAt = Date.now();
    badge.progress = 1;

    // Award 1 point for exploration
    await this.awardPoints(
      1,
      'achievement_unlock',
      'First time opening settings',
      { badgeId: 'first_time_explorer' }
    );

    await this.save();
    this.logger.info('First Time Explorer badge earned!');
    
    return badge;
  }

  private mergeWithDefaults(loadedData: Partial<GamificationData>): GamificationData {
    const merged = {
      ...DEFAULT_GAMIFICATION_DATA,
      ...loadedData,
      badges: this.mergeBadges(loadedData.badges || []),
      quests: this.mergeQuests(loadedData.quests || [])
    };

    return merged;
  }

  private mergeBadges(loadedBadges: Badge[]): Badge[] {
    return DEFAULT_BADGES.map(defaultBadge => {
      const loadedBadge = loadedBadges.find(b => b.id === defaultBadge.id);
      return loadedBadge ? { ...defaultBadge, ...loadedBadge } : { ...defaultBadge, progress: 0 };
    });
  }

  private mergeQuests(loadedQuests: Quest[]): Quest[] {
    return DEFAULT_QUESTS.map(defaultQuest => {
      const loadedQuest = loadedQuests.find(q => q.id === defaultQuest.id);
      return loadedQuest || defaultQuest;
    });
  }

  private async validateAndMigrate(): Promise<void> {
    let needsSave = false;

    // Ensure all default themes are available
    if (!this.data.unlockedThemes.includes('default')) {
      this.data.unlockedThemes.push('default');
      needsSave = true;
    }

    // Ensure current theme is unlocked
    if (!this.data.unlockedThemes.includes(this.data.currentDockTheme)) {
      this.data.currentDockTheme = 'default';
      needsSave = true;
    }

    // Validate points
    if (this.data.points < 0) {
      this.data.points = 0;
      needsSave = true;
    }

    if (needsSave) {
      await this.save();
    }
  }
} 