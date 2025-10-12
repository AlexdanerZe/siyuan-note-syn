/**
 * 插件日志系统
 * 提供统一的日志记录和调试功能
 */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static instance: Logger;
    private pluginName: string;
    private logLevel: LogLevel;
    private logs: Array<{
        timestamp: string;
        level: string;
        message: string;
        data?: any;
    }> = [];

    private constructor(pluginName: string, logLevel: LogLevel = LogLevel.DEBUG) {
        this.pluginName = pluginName;
        this.logLevel = logLevel;
    }

    public static getInstance(pluginName?: string, logLevel?: LogLevel): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(pluginName || 'SiYuan-Plugin', logLevel);
        }
        return Logger.instance;
    }

    private formatMessage(level: string, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${this.pluginName}] [${level}]`;
        return data ? `${prefix} ${message} | Data: ${JSON.stringify(data)}` : `${prefix} ${message}`;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.logLevel;
    }

    private addToHistory(level: string, message: string, data?: any) {
        this.logs.push({
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        });
        
        // 保持最近1000条日志
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000);
        }
    }

    public debug(message: string, data?: any) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formattedMessage = this.formatMessage('DEBUG', message, data);
            console.debug(formattedMessage);
            this.addToHistory('DEBUG', message, data);
        }
    }

    public info(message: string, data?: any) {
        if (this.shouldLog(LogLevel.INFO)) {
            const formattedMessage = this.formatMessage('INFO', message, data);
            console.info(formattedMessage);
            this.addToHistory('INFO', message, data);
        }
    }

    public warn(message: string, data?: any) {
        if (this.shouldLog(LogLevel.WARN)) {
            const formattedMessage = this.formatMessage('WARN', message, data);
            console.warn(formattedMessage);
            this.addToHistory('WARN', message, data);
        }
    }

    public error(message: string, error?: any) {
        if (this.shouldLog(LogLevel.ERROR)) {
            const formattedMessage = this.formatMessage('ERROR', message, error);
            console.error(formattedMessage);
            if (error instanceof Error) {
                console.error('Stack trace:', error.stack);
            }
            this.addToHistory('ERROR', message, error);
        }
    }

    public logMethodEntry(className: string, methodName: string, params?: any) {
        this.debug(`进入方法: ${className}.${methodName}`, params);
    }

    public logMethodExit(className: string, methodName: string, result?: any) {
        this.debug(`退出方法: ${className}.${methodName}`, result);
    }

    public logState(description: string, state: any) {
        this.debug(`状态检查: ${description}`, state);
    }

    public logEvent(eventName: string, eventData?: any) {
        this.info(`事件触发: ${eventName}`, eventData);
    }

    public getLogHistory(): Array<{timestamp: string; level: string; message: string; data?: any}> {
        return [...this.logs];
    }

    public exportLogs(): string {
        return this.logs.map(log => {
            const dataStr = log.data ? ` | Data: ${JSON.stringify(log.data)}` : '';
            return `[${log.timestamp}] [${log.level}] ${log.message}${dataStr}`;
        }).join('\n');
    }

    public clearLogs() {
        this.logs = [];
        this.info('日志历史已清空');
    }

    public setLogLevel(level: LogLevel) {
        this.logLevel = level;
        this.info(`日志级别已设置为: ${LogLevel[level]}`);
    }
}

// 创建全局日志实例
export const logger = Logger.getInstance('DailyProgressSync', LogLevel.DEBUG);