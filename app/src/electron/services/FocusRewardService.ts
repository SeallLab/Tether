import { BrowserWindow, Notification } from 'electron';
import { WorkPatternAnalyzer } from './WorkPatternAnalyzer.js';
import { GamificationService } from './GamificationService.js';
import { ActivityLogger } from './ActivityLogger.js';
import type { Badge, Quest } from '../../shared/types.js';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { Logger } from '../utils/Logger.js';
import { injectable } from 'tsyringe';

@injectable()
export class FocusRewardService {
  private workPatternAnalyzer: WorkPatternAnalyzer;
  private gamificationService: GamificationService;
  private activityLogger: ActivityLogger;
  private lastRewardCheck: number = 0;
  private logger: Logger;
  constructor(
    gamificationService: GamificationService,
    activityLogger: ActivityLogger
  ) {
    this.workPatternAnalyzer = new WorkPatternAnalyzer();
    this.gamificationService = gamificationService;
    this.activityLogger = activityLogger;
    this.logger = new Logger({ name: 'FocusRewardService' });
  }

  /**
   * Start monitoring for focus rewards
   */
  async startMonitoring(): Promise<void> {
    this.lastRewardCheck = Date.now();
    
    // Check for rewards every 10 minutes
    setInterval(() => {
      this.checkAndAwardFocusRewards();
    }, 1 * 60 * 100);
    
  }

  /**
   * trigger a focus reward check
   */
  async checkAndAwardFocusRewards(): Promise<void> {
    try {
      const now = Date.now();
      const timeSinceLastCheck = now - this.lastRewardCheck;
      
      const recentLogs = await this.activityLogger.getRecentLogs(120);
      const longerLogs = await this.activityLogger.getRecentLogs(1200);
      const workPattern = this.workPatternAnalyzer.analyzeWorkPattern(recentLogs, 60);
      const consistentWork = this.workPatternAnalyzer.hasBeenConsistentlyWorking(longerLogs, 60, 5);
      
      // Award points for 60+ minute focus sessions
      if (consistentWork.isConsistent && consistentWork.workDuration >= 60) {
        await this.awardFocusSessionPoints(consistentWork.workDuration, consistentWork.primaryActivity);
      }

      // Check for streak bonuses and other achievements
      await this.checkStreaksAndAchievements(workPattern, consistentWork);
      
      this.lastRewardCheck = now;
      
    } catch (error) {
      this.logger.error('Error checking focus rewards:', error);
    }
  }

  /**
   * Award points for a focus session
   */
  private async awardFocusSessionPoints(durationMinutes: number, primaryActivity: string): Promise<void> {
    // Award 1 point per 60-minute block
    const pointsToAward = Math.floor(durationMinutes / 60);
    
    if (pointsToAward === 0) return;

    const event = await this.gamificationService.awardPoints(
      pointsToAward,
      'focus_session',
      `${durationMinutes}-minute focus session`,
      {
        sessionDuration: durationMinutes,
        primaryActivity,
        timestamp: Date.now()
      }
    );

    // Update streaks and check for new badges/quests
    await this.updateProgress(durationMinutes);

    // Send notification about points earned
    await this.sendPointEarnedNotification(pointsToAward, durationMinutes);
  }

  /**
   * Update gamification progress (streaks, badges, quests)
   */
  private async updateProgress(sessionDurationMinutes: number): Promise<void> {
    const sessionStartHour = new Date().getHours();

    // Update focus streaks
    await this.gamificationService.updateFocusStreaks(sessionDurationMinutes);

    // Update quest progress
    const completedQuests = await this.gamificationService.updateQuestProgress(sessionDurationMinutes);
    
    // Update badge progress
    const earnedBadges = await this.gamificationService.updateBadgeProgress(sessionDurationMinutes, sessionStartHour);

    // Send notifications for completed quests
    for (const quest of completedQuests) {
      await this.sendQuestCompletedNotification(quest);
    }

    // Send notifications for earned badges
    for (const badge of earnedBadges) {
      await this.sendBadgeEarnedNotification(badge);
    }
  }

  /**
   * Check for streak bonuses and other achievements
   */
  private async checkStreaksAndAchievements(workPattern: any, consistentWork: any): Promise<void> {
    const data = this.gamificationService.getData();
    
    // Check for daily streak bonus (award bonus points for 3+ hours of daily focus)
    if (data.streaks.dailyFocus >= 180 && !this.hasAchievementToday('daily_streak_bonus')) {
      await this.gamificationService.awardPoints(
        5,
        'streak_bonus',
        'Daily focus streak bonus (3+ hours)',
        { streakType: 'daily', streakValue: data.streaks.dailyFocus }
      );
    }

    // Check for weekly streak bonus
    if (data.streaks.weeklyFocus >= 1200 && !this.hasAchievementThisWeek('weekly_streak_bonus')) {
      await this.gamificationService.awardPoints(
        20,
        'streak_bonus',
        'Weekly focus streak bonus (20+ hours)',
        { streakType: 'weekly', streakValue: data.streaks.weeklyFocus }
      );
    }

    // Check for excellent focus quality bonus
    if (workPattern.focusQuality === 'excellent' && workPattern.totalWorkTime >= 120) {
      await this.gamificationService.awardPoints(
        2,
        'achievement_unlock',
        'Excellent focus quality bonus',
        { focusQuality: workPattern.focusQuality, workTime: workPattern.totalWorkTime }
      );
    }
  }

  /**
   * Send notification when points are earned
   */
  private async sendPointEarnedNotification(points: number, durationMinutes: number): Promise<void> {
    const totalPoints = this.gamificationService.getData().points;
    const level = this.gamificationService.getData().level;

    const title = `🎯 ${points} Point${points > 1 ? 's' : ''} Earned!`;
    const body = `Great ${durationMinutes}-minute focus session! You now have ${totalPoints} points (Level ${level})`;

    try {
      // Create system notification with click handler
      const notification = new Notification({
        title,
        body,
        silent: false
      });

      notification.on('click', () => {
        this.openRewardsTab();
      });

      notification.show();

      // Also send to UI via IPC
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window: BrowserWindow) => {
        window.webContents.send(IPC_CHANNELS.POINT_EARNED_NOTIFICATION, {
          points,
          description: `${durationMinutes}-minute focus session`,
          totalPoints,
          level,
          durationMinutes
        });
      });

    } catch (error) {
      console.error('[FocusRewardService] Failed to send points notification:', error);
    }
  }

  /**
   * Send notification when a quest is completed
   */
  private async sendQuestCompletedNotification(quest: Quest): Promise<void> {
    const title = `🏆 Quest Completed!`;
    const body = `"${quest.name}" - ${quest.reward.description}`;

    try {
      const notification = new Notification({
        title,
        body,
        silent: false
      });

      notification.on('click', () => {
        this.openRewardsTab();
      });

      notification.show();

      // Send to UI via IPC
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window: BrowserWindow) => {
        window.webContents.send('quest-completed', quest);
      });

    } catch (error) {
      this.logger.error('Failed to send quest notification:', error);
    }
  }

  /**
   * Send notification when a badge is earned
   */
  private async sendBadgeEarnedNotification(badge: Badge): Promise<void> {
    const title = `🏅 Badge Unlocked!`;
    const body = `${badge.icon} ${badge.name} - ${badge.description}`;

    try {
      const notification = new Notification({
        title,
        body,
        silent: false
      });

      notification.on('click', () => {
        this.openRewardsTab();
      });

      notification.show();

      // Send to UI via IPC
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach((window: BrowserWindow) => {
        window.webContents.send('badge-earned', badge);
      });

    } catch (error) {
      this.logger.error('Failed to send badge notification:', error);
    }
  }

  /**
   * Open the rewards/gamification tab in settings
   */
  private openRewardsTab(): void {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach((window: BrowserWindow) => {
      // First try to show an existing settings window
      window.webContents.send('open-rewards-tab');
      
      // If no settings window exists, this will be handled by the main window
      // which can open settings and navigate to rewards tab
      window.show();
      window.focus();
    });
  }

  /**
   * Check if user has specific achievement today
   */
  private hasAchievementToday(achievementType: string): boolean {
    const today = new Date().toDateString();
    const data = this.gamificationService.getData();
    
    return data.achievements.some(achievement => 
      achievement.trigger === achievementType &&
      new Date(achievement.earnedAt).toDateString() === today
    );
  }

  /**
   * Check if user has specific achievement this week
   */
  private hasAchievementThisWeek(achievementType: string): boolean {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const data = this.gamificationService.getData();
    
    return data.achievements.some(achievement => 
      achievement.trigger === achievementType &&
      new Date(achievement.earnedAt) >= weekStart
    );
  }
} 