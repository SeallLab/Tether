import { ActivityLog, ActivityType, WindowData, IdleData } from '../../shared/types.js';
import { injectable } from 'tsyringe';

export interface WorkSession {
  startTime: number;
  endTime: number;
  duration: number; // in minutes
  primaryApplication: string;
  windowTitles: string[];
  activityCount: number;
  focusScore: number; // 0-1, based on consistency
}

export interface WorkPattern {
  totalWorkTime: number; // in minutes
  sessions: WorkSession[];
  mostUsedApps: Array<{ app: string; duration: number; percentage: number }>;
  focusQuality: 'excellent' | 'good' | 'fair' | 'poor';
  distractionEvents: number;
  longestFocusStreak: number; // in minutes
}

@injectable()
export class WorkPatternAnalyzer {
  
  /**
   * Analyze recent activity logs to determine work patterns
   */
  public analyzeWorkPattern(logs: ActivityLog[], timeWindowMinutes: number = 30): WorkPattern {
    const windowLogs = logs.filter(log => log.type === ActivityType.WINDOW_CHANGE);
    const idleLogs = logs.filter(log => log.type === ActivityType.IDLE);
    
    const sessions = this.extractWorkSessions(windowLogs, idleLogs, timeWindowMinutes);
    const appUsage = this.calculateAppUsage(windowLogs, timeWindowMinutes);
    const focusMetrics = this.calculateFocusMetrics(sessions, idleLogs);
    
    return {
      totalWorkTime: sessions.reduce((total, session) => total + session.duration, 0),
      sessions,
      mostUsedApps: appUsage,
      focusQuality: this.determineFocusQuality(focusMetrics.averageFocusScore),
      distractionEvents: focusMetrics.distractionCount,
      longestFocusStreak: focusMetrics.longestStreak
    };
  }

  /**
   * Generate contextual encouragement message based on work pattern
   */
  public generateEncouragementMessage(pattern: WorkPattern, currentWorkDuration: number): string {
    const messages = this.getEncouragementMessages();
    
    // Choose message based on work pattern and current session
    if (currentWorkDuration >= 60) { // 1+ hour of continuous work
      if (pattern.focusQuality === 'excellent') {
        return this.selectRandom(messages.longFocusExcellent);
      } else {
        return this.selectRandom(messages.longFocusGood);
      }
    } else if (currentWorkDuration >= 30) { // 30+ minutes
      if (pattern.mostUsedApps.length > 0) {
        const primaryApp = pattern.mostUsedApps[0].app;
        return this.selectRandom(messages.mediumFocus).replace('{app}', primaryApp);
      } else {
        return this.selectRandom(messages.mediumFocus).replace('{app}', 'your current task');
      }
    } else { // 15-30 minutes
      if (pattern.distractionEvents === 0) {
        return this.selectRandom(messages.shortFocusClean);
      } else {
        return this.selectRandom(messages.shortFocusWithDistractions);
      }
    }
  }

  /**
   * Determine if user has been consistently working
   */
  public hasBeenConsistentlyWorking(
    logs: ActivityLog[], 
    thresholdMinutes: number,
    maxIdleGapMinutes: number = 5
  ): { isConsistent: boolean; workDuration: number; primaryActivity: string } {
    const now = Date.now();
    const thresholdMs = thresholdMinutes * 60 * 1000;
    const recentLogs = logs.filter(log => (now - log.timestamp) <= thresholdMs);
    
    if (recentLogs.length === 0) {
      return { isConsistent: false, workDuration: 0, primaryActivity: 'unknown' };
    }

    // Check for significant idle periods
    const idleLogs = recentLogs.filter(log => 
      log.type === ActivityType.IDLE && 
      (log.data as IdleData).was_idle === true &&
      (log.data as IdleData).idle_duration > (maxIdleGapMinutes * 60)
    );

    // If there were long idle periods, not consistently working
    if (idleLogs.length > 0) {
      return { isConsistent: false, workDuration: 0, primaryActivity: 'unknown' };
    }

    // Analyze window activity to determine primary activity
    const windowLogs = recentLogs.filter(log => log.type === ActivityType.WINDOW_CHANGE);
    const primaryActivity = this.getPrimaryActivity(windowLogs);    // Calculate actual work duration (excluding short idle periods)
    const workDuration = this.calculateActiveWorkDuration(recentLogs, maxIdleGapMinutes);    
    // Consider it consistent if work duration is at least 50% of the threshold
    const isConsistent = workDuration >= (thresholdMinutes * 0.5);
    
    return {
      isConsistent,
      workDuration,
      primaryActivity
    };
  }

  private extractWorkSessions(
    windowLogs: ActivityLog[], 
    idleLogs: ActivityLog[], 
    timeWindowMinutes: number
  ): WorkSession[] {
    const sessions: WorkSession[] = [];
    const now = Date.now();
    const windowMs = timeWindowMinutes * 60 * 1000;
    
    // Group window changes by time proximity (sessions separated by >5 min idle)
    let currentSession: Partial<WorkSession> | null = null;
    
    for (const log of windowLogs.sort((a, b) => a.timestamp - b.timestamp)) {
      if ((now - log.timestamp) > windowMs) continue;
      
      const windowData = log.data as WindowData;
      
      if (!currentSession || (log.timestamp - (currentSession.endTime || 0)) > 5 * 60 * 1000) {
        // Start new session
        if (currentSession) {
          sessions.push(this.finalizeSession(currentSession));
        }
        
        currentSession = {
          startTime: log.timestamp,
          endTime: log.timestamp,
          primaryApplication: windowData.application_name || 'Unknown',
          windowTitles: [windowData.window_title || 'Unknown'],
          activityCount: 1
        };
      } else {
        // Continue current session
        currentSession.endTime = log.timestamp;
        currentSession.activityCount = (currentSession.activityCount || 0) + 1;
        
        if (windowData.window_title && !currentSession.windowTitles?.includes(windowData.window_title)) {
          currentSession.windowTitles?.push(windowData.window_title);
        }
      }
    }
    
    if (currentSession) {
      sessions.push(this.finalizeSession(currentSession));
    }
    
    return sessions;
  }

  private finalizeSession(session: Partial<WorkSession>): WorkSession {
    const duration = ((session.endTime || 0) - (session.startTime || 0)) / (1000 * 60);
    const focusScore = Math.min(1, (session.activityCount || 0) / Math.max(1, duration / 5));
    
    return {
      startTime: session.startTime || 0,
      endTime: session.endTime || 0,
      duration,
      primaryApplication: session.primaryApplication || 'Unknown',
      windowTitles: session.windowTitles || [],
      activityCount: session.activityCount || 0,
      focusScore
    };
  }

  private calculateAppUsage(windowLogs: ActivityLog[], timeWindowMinutes: number): Array<{ app: string; duration: number; percentage: number }> {
    const appDurations: Record<string, number> = {};
    const now = Date.now();
    const windowMs = timeWindowMinutes * 60 * 1000;
    
    let lastApp = '';
    let lastTimestamp = 0;
    
    for (const log of windowLogs.sort((a, b) => a.timestamp - b.timestamp)) {
      if ((now - log.timestamp) > windowMs) continue;
      
      const windowData = log.data as WindowData;
      const app = windowData.application_name || 'Unknown';
      
      if (lastApp && lastTimestamp) {
        const duration = (log.timestamp - lastTimestamp) / (1000 * 60);
        appDurations[lastApp] = (appDurations[lastApp] || 0) + duration;
      }
      
      lastApp = app;
      lastTimestamp = log.timestamp;
    }
    
    const totalDuration = Object.values(appDurations).reduce((sum, duration) => sum + duration, 0);
    
    return Object.entries(appDurations)
      .map(([app, duration]) => ({
        app,
        duration,
        percentage: totalDuration > 0 ? (duration / totalDuration) * 100 : 0
      }))
      .sort((a, b) => b.duration - a.duration);
  }

  private calculateFocusMetrics(sessions: WorkSession[], idleLogs: ActivityLog[]): {
    averageFocusScore: number;
    distractionCount: number;
    longestStreak: number;
  } {
    const averageFocusScore = sessions.length > 0 
      ? sessions.reduce((sum, session) => sum + session.focusScore, 0) / sessions.length
      : 0;
    
    const distractionCount = idleLogs.filter(log => {
      const idleData = log.data as IdleData;
      return idleData.was_idle && idleData.idle_duration > 60; // >1 min idle = distraction
    }).length;
    
    const longestStreak = sessions.length > 0 
      ? Math.max(...sessions.map(session => session.duration))
      : 0;
    
    return { averageFocusScore, distractionCount, longestStreak };
  }

  private determineFocusQuality(averageFocusScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (averageFocusScore >= 0.8) return 'excellent';
    if (averageFocusScore >= 0.6) return 'good';
    if (averageFocusScore >= 0.4) return 'fair';
    return 'poor';
  }

  private getPrimaryActivity(windowLogs: ActivityLog[]): string {
    if (windowLogs.length === 0) return 'unknown';
    
    const appCounts: Record<string, number> = {};
    
    windowLogs.forEach(log => {
      const windowData = log.data as WindowData;
      const app = windowData.application_name || 'Unknown';
      appCounts[app] = (appCounts[app] || 0) + 1;
    });
    
    const primaryApp = Object.entries(appCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';
    
    return primaryApp;
  }

  private calculateActiveWorkDuration(logs: ActivityLog[], maxIdleGapMinutes: number): number {
    const sortedLogs = logs.sort((a, b) => a.timestamp - b.timestamp);
    if (sortedLogs.length === 0) return 0;
    
    const startTime = sortedLogs[0].timestamp;
    const endTime = sortedLogs[sortedLogs.length - 1].timestamp;
    console.log('[WorkPatternAnalyzer] Start time:', startTime, 'End time:', endTime);
    const totalDuration = (endTime - startTime) / (1000 * 60);
    
    // Subtract idle periods longer than maxIdleGapMinutes
    const idleLogs = logs.filter(log => log.type === ActivityType.IDLE);
    const longIdleDuration = idleLogs
      .filter(log => {
        const idleData = log.data as IdleData;
        return idleData.was_idle && idleData.idle_duration > (maxIdleGapMinutes * 60);
      })
      .reduce((sum, log) => {
        const idleData = log.data as IdleData;
        return sum + Math.max(0, (idleData.idle_duration / 60) - maxIdleGapMinutes);
      }, 0);
    
    return Math.max(0, totalDuration - longIdleDuration);
  }

  private getEncouragementMessages() {
    return {
      longFocusExcellent: [
        "Incredible focus! You've been in the zone for over an hour. Your dedication is paying off! 🔥",
        "Amazing work! You're showing exceptional focus and concentration. Keep this momentum going! ⭐",
        "Outstanding! You've maintained deep focus for an extended period. This is how great work gets done! 🎯",
        "Phenomenal concentration! You're in a state of flow that many people struggle to achieve. Brilliant! 💎"
      ],
      longFocusGood: [
        "Great job staying focused for over an hour! You're building excellent work habits. 💪",
        "Solid work session! You've shown real commitment to your tasks. Keep it up! 🚀",
        "Nice focus streak! An hour of dedicated work is something to be proud of. 👏",
        "Well done! You've demonstrated strong concentration skills. Your effort shows! ✨"
      ],
      mediumFocus: [
        "Good work on {app}! You're maintaining steady focus. Keep the momentum going! 📈",
        "Nice progress! You've been consistently working for a solid stretch. 🎯",
        "Great focus! You're showing good concentration on your current task. 💡",
        "Steady work! You're building good focus habits with this session. 🌟"
      ],
      shortFocusClean: [
        "Clean focus session! No distractions detected. You're developing great concentration! 🎯",
        "Perfect! You've maintained focus without any interruptions. Excellent self-discipline! ⚡",
        "Distraction-free work! This is exactly how to build strong focus muscles. 💪",
        "Great job! You stayed on task without getting sidetracked. Keep this up! 🎪"
      ],
      shortFocusWithDistractions: [
        "Good work! You got back on track after some distractions. That's real focus skill! 🔄",
        "Nice recovery! Managing distractions and returning to work shows maturity. 🎯",
        "Well done! You didn't let interruptions derail your progress completely. 💪",
        "Good focus management! You're learning to handle distractions effectively. 📚"
      ]
    };
  }

  private selectRandom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
} 