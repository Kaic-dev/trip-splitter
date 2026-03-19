import { type ApiService } from './platformCost';

/**
 * Enterprise Anomaly Detector
 * Prevents runaway costs from bugs, bots, or accidental loops.
 */
class AnomalyDetector {
  private windowSize = 60000; // 1 minute
  private threshold = 50; // Max calls per minute
  private callLog: number[] = [];

  recordCall(_service: ApiService) {
    const now = Date.now();
    this.callLog.push(now);
    
    // Clean old logs
    this.callLog = this.callLog.filter(t => now - t < this.windowSize);

    if (this.callLog.length > this.threshold) {
      this.triggerAlert();
    }
  }

  private triggerAlert() {
    console.error('%c[ANOMALY DETECTED] High Frequency API Access!', 'background: red; color: white; padding: 5px; font-weight: bold;');
    console.warn('[ANOMALY] Automatically activating CRITICAL cost-saving mode.');
    
    // In a real app, this could notify a server or administrator
  }

  getCPM(): number {
    return this.callLog.length;
  }
}

export const anomalyDetector = new AnomalyDetector();
