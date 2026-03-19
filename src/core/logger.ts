import type { LocationResult } from '../types';

/**
 * Unified Logger Utility
 * Supports levels, grouping, and context-aware formatting.
 * Controlled by window.DEBUG_LOGS global flag.
 */

declare global {
  interface Window {
    DEBUG_LOGS: boolean;
    DEBUG_NARRATIVE: boolean;
  }
}

// Default to true in development
if (typeof window !== 'undefined') {
  if (window.DEBUG_LOGS === undefined) window.DEBUG_LOGS = import.meta.env.DEV;
  if (window.DEBUG_NARRATIVE === undefined) window.DEBUG_NARRATIVE = true;
}

// --- Global Flow Context Manager ---
interface FlowContext {
  flowId: string;
  startTime: number;
  inputRaw?: string;
  interpretedIntent?: string;
  selectedEntity?: string;
  alternatives?: any[];
  route?: any;
  cost?: any;
  explanation: string[];
}

class FlowManager {
  private contexts = new Map<string, FlowContext>();

  create(flowId: string): FlowContext {
    const ctx = { flowId, startTime: performance.now(), explanation: [] };
    this.contexts.set(flowId, ctx);
    return ctx;
  }

  get(flowId: string): FlowContext | undefined {
    return this.contexts.get(flowId);
  }

  update(flowId: string, delta: Partial<FlowContext>) {
    const ctx = this.get(flowId);
    if (ctx) {
      Object.assign(ctx, delta);
    }
  }

  addExplanation(flowId: string, note: string) {
    const ctx = this.get(flowId);
    if (ctx) ctx.explanation.push(note);
  }
}

export const flowManager = new FlowManager();

// --- Logger Utility ---
export const LogLevel = {
  INFO: 'INFO',
  DEBUG: 'DEBUG',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SUCCESS: 'SUCCESS'
} as const;

type LogLevelType = typeof LogLevel[keyof typeof LogLevel];

const COLORS = {
  [LogLevel.INFO]: '#4299e1',
  [LogLevel.DEBUG]: '#718096',
  [LogLevel.WARN]: '#ecc94b',
  [LogLevel.ERROR]: '#f56565',
  [LogLevel.SUCCESS]: '#48bb78',
};

const HUMAN_PREFIXES: Record<string, string> = {
  'INTENT ANALYSIS': '🧠 Interpreting input',
  'DECISION': '🎯 Decision logic',
  'WHY THIS RESULT': '🎯 Selected',
  'REJECTION ANALYSIS': '🚫 Alternatives considered',
  'GEO CONSISTENCY': '🌍 Geographic check',
  'SEARCH FLOW': '🔍 Search phase hit',
  'CALCULATION PHASE': '⚡ Trip calculation',
  'HISTORY DECISION': '📜 History updated',
  'TRIP CONTEXT': '🚀 Trip starting',
  'UX SUGGESTION': '💡 Suggestion',
  'CACHE IMPACT': '📦 Cache impact',
  'USER CHOICE': '🖱️ User selected',
  'RESOLUTION': '📌 Resolved to coordinates',
  'FINAL LOCATION': '🏁 Final destination set',
  'INPUT TRACE': '📝 Processed input',
  'SUCCESSFUL SEARCH': '✅ Search completed',
  'FLOW COMPLETED SUCCESSFULLY': '🏁 Journey ended'
};

export class Logger {
  private prefix: string;
  private flowId: string | null = null;
  private lastLogs: Set<string> = new Set();

  constructor(prefix: string, flowId: string | null = null) {
    this.prefix = prefix;
    this.flowId = flowId;
    if (typeof window !== 'undefined') {
      setInterval(() => this.lastLogs.clear(), 500);
    }
  }

  static createFlowId(): string {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
  }

  withFlow(flowId: string): Logger {
    return new Logger(this.prefix, flowId);
  }

  private shouldLog(level: LogLevelType, message: string): boolean {
    if (!window.DEBUG_LOGS && level === LogLevel.DEBUG) return false;
    const key = `${level}:${message}`;
    if (this.lastLogs.has(key)) return false;
    this.lastLogs.add(key);
    return true;
  }

  private formatMessage(level: LogLevelType, message: string): string[] {
    const flowTag = this.flowId ? ` [FLOW:${this.flowId}]` : '';
    let label = message;
    let showLevel = true;
    
    if (window.DEBUG_NARRATIVE && HUMAN_PREFIXES[message]) {
      label = HUMAN_PREFIXES[message];
      showLevel = false;
    }

    const levelTag = showLevel ? ` [${level}]` : '';

    return [
      `%c[${this.prefix}]${flowTag}${levelTag} %s`,
      `color: ${COLORS[level]}; font-weight: bold;`,
      label
    ];
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO, message)) {
      console.log(...this.formatMessage(LogLevel.INFO, message), ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG, message)) {
      console.log(...this.formatMessage(LogLevel.DEBUG, message), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN, message)) {
      console.warn(...this.formatMessage(LogLevel.WARN, message), ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR, message)) {
      console.error(...this.formatMessage(LogLevel.ERROR, message), ...args);
    }
  }

  success(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.SUCCESS, message)) {
      console.log(...this.formatMessage(LogLevel.SUCCESS, message), ...args);
    }
  }

  table(label: string, data: any[]) {
    if (window.DEBUG_LOGS) {
      console.log(`%c[${this.prefix}] [TABLE] ${label}`, 'font-weight: bold; color: #4a5568;');
      console.table(data);
    }
  }

  decision(label: string, data: any) {
    if (this.shouldLog(LogLevel.INFO, label)) {
      const displayLabel = window.DEBUG_NARRATIVE ? `🎯 ${label}` : `[DECISION] ${label}`;
      console.log(
        `%c[${this.prefix}] ${displayLabel}`,
        'color: #805ad5; font-weight: bold; border-left: 4px solid #805ad5; padding-left: 8px; background: #faf5ff;',
        data
      );
    }
  }

  uxSuggestion(suggestion: { action: string, reason?: string }) {
    const label = window.DEBUG_NARRATIVE ? '💡 UX TIP' : '[UX SUGGESTION]';
    console.log(
      `%c[${this.prefix}] ${label} %s`,
      'color: #3182ce; font-weight: bold; background: #ebf8ff; padding: 2px 6px; border-radius: 4px;',
      suggestion.action,
      suggestion.reason || ''
    );
  }

  timing(label: string, totalMs: number, phases?: Record<string, number>) {
    const prefix = window.DEBUG_NARRATIVE ? '⚡ Timing' : '[TIMING]';
    console.log(
      `%c[${this.prefix}] ${prefix} %s: %c${totalMs.toFixed(1)}ms`,
      'font-weight: bold; color: #4a5568;',
      label,
      'color: #3182ce; font-weight: bold;',
      phases || ''
    );
  }

  cacheImpact(name: string, impact: { savedRequests: number, avoidedLatencyMs: number, source: string }) {
    const prefix = window.DEBUG_NARRATIVE ? '📦 Cache saved time!' : '[CACHE IMPACT]';
    console.log(
      `%c[${this.prefix}] ${prefix} %s`,
      'color: #2f855a; font-weight: bold; background: #f0fff4; padding: 2px 6px;',
      name,
      impact
    );
  }

  historyDecision(data: { action: 'ADD_NEW' | 'MOVE_TO_TOP' | 'SKIP', reason: string, entityType: string, size: number }) {
    const prefix = window.DEBUG_NARRATIVE ? '📜 History Narrative' : '[HISTORY DECISION]';
    console.log(`%c[${this.prefix}] ${prefix}`, 'color: #718096; font-style: italic;', data);
  }

  final(label: string, data: any) {
    const prefix = window.DEBUG_NARRATIVE ? '✨ Flow Result' : '[FLOW SUMMARY]';
    console.log(
      `%c[${this.prefix}] ${prefix} %c%s`,
      'color: #2c5282; font-weight: bold; font-size: 1.1em; background: #ebf8ff; padding: 6px 12px; border: 1px solid #90cdf4; border-radius: 6px;',
      'color: #2b6cb0; font-weight: normal;',
      label.toUpperCase(),
      data
    );
  }

  logSystemAnswer(data: {
    userInput: string;
    interpretedAs: string;
    resolvedLocation: { label: string; type: string; confidence: string };
    alternatives?: any[];
    route?: { distance: string; duration: string; strategy: string };
    cost?: { fuel: number; margin: number; total: number };
    explanation: string[];
  }) {
    console.log(
      `%c[SYSTEM ANSWER] ⭐ HUMAN-READABLE STORY ⭐`,
      'color: #ffffff; background: #2b6cb0; font-size: 1.1em; font-weight: bold; padding: 4px 12px; border-radius: 4px;'
    );
    console.log(
      `%cWHAT HAPPENED:%c User searched for "${data.userInput}" and chose "${data.resolvedLocation.label}".`,
      'font-weight: bold; color: #2c5282;',
      'color: #1a202c;'
    );
    console.log(
      `%cWHY:%c ${data.explanation.join(' | ')}`,
      'font-weight: bold; color: #2c5282;',
      'color: #4a5568;'
    );
    if (data.route && data.cost) {
      console.log(
        `%cOUTCOME:%c Final trip is ${data.route.distance} and costs R$ ${data.cost.total.toFixed(2)}.`,
        'font-weight: bold; color: #2c5282;',
        'color: #1a202c;'
      );
    }
    console.log('%cDetailed breakdown:', 'color: #718096; font-size: 0.9em;', data);
  }

  cache(name: string, status: 'HIT' | 'MISS' | 'COALESCED', context?: any) {
    if (this.shouldLog(LogLevel.DEBUG, `cache:${name}`)) {
      const color = status === 'HIT' ? '#38a169' : (status === 'MISS' ? '#e53e3e' : '#3182ce');
      console.log(
        `%c[${this.prefix}] [CACHE] %s: %c${status}`,
        'font-weight: bold; color: #4a5568;',
        name,
        `color: ${color}; font-weight: bold;`,
        context || ''
      );
    }
  }

  group(label: string, context?: any) {
    if (window.DEBUG_LOGS) {
      const flowTag = this.flowId ? ` [FLOW:${this.flowId}]` : '';
      const prefix = window.DEBUG_NARRATIVE ? '🎬 Start Journey' : '[USER ACTION]';
      console.group(`%c${prefix}${flowTag} ${label}`, 'color: #805ad5; font-weight: bold; font-size: 1.1em;', context || '');
    }
  }

  groupEnd() {
    if (window.DEBUG_LOGS) {
      console.groupEnd();
    }
  }
}

export const createLogger = (name: string) => new Logger(name);

/**
 * Classifies a LocationResult into human-readable categories.
 */
export function classifyLocation(result: LocationResult | Partial<LocationResult>): string {
  const type = (result.type as string)?.toLowerCase() || 'unknown';
  
  if (type === 'poi' || result.id?.startsWith('poi')) return '🏢 POI';
  if (type === 'address') return '🏠 ADDRESS';
  if (type === 'street' || type === 'road') return '🛣️ STREET';
  if (type === 'place' || type === 'city' || type === 'locality') return '🏙️ CITY';
  if (type === 'neighborhood' || type === 'district') return '🏘️ NEIGHBORHOOD';
  
  const name = (result.name || '').toLowerCase();
  const addr = (result.fullAddress || '').toLowerCase();
  if (name.includes('rua') || addr.includes('rua')) return '🛣️ STREET';
  if (name.includes('avenida') || addr.includes('avenida')) return '🛣️ AVENUE';
  
  return `📍 ${type.toUpperCase()}`;
}
