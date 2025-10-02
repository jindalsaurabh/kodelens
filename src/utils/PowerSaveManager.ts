// src/utils/PowerSaveManager.ts
import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';

export class PowerSaveManager {
    private sleepProcess: any = null;
    private isPreventingSleep = false;

    public preventSleep(reason: string = 'Kodelens indexing'): void {
        if (this.isPreventingSleep) {
            return;
        }

        try {
            const platform = os.platform();
            console.log(`[PowerSaveManager] Preventing sleep on ${platform} for: ${reason}`);
            
            switch (platform) {
                case 'darwin': // macOS
                    this.sleepProcess = exec('caffeinate -d -i -m -u &', (error) => {
                        if (error) {
                            console.warn('[PowerSaveManager] macOS caffeinate failed:', error);
                            this.fallbackSleepPrevention(reason);
                        } else {
                            this.isPreventingSleep = true;
                        }
                    });
                    break;
                    
                case 'win32': // Windows
                    exec('powercfg -change -standby-timeout-ac 0', (error) => {
                        if (error) {
                            console.warn('[PowerSaveManager] Windows powercfg failed:', error);
                            this.fallbackSleepPrevention(reason);
                        } else {
                            this.isPreventingSleep = true;
                        }
                    });
                    break;
                    
                case 'linux': // Linux
                    exec('systemctl inhibit --what=sleep --who="Kodelens" --why="Indexing"', (error) => {
                        if (error) {
                            console.warn('[PowerSaveManager] Linux systemctl failed:', error);
                            this.fallbackSleepPrevention(reason);
                        } else {
                            this.isPreventingSleep = true;
                        }
                    });
                    break;
                    
                default:
                    this.fallbackSleepPrevention(reason);
                    break;
            }
            
        } catch (error) {
            console.warn('[PowerSaveManager] Could not prevent sleep:', error);
            this.fallbackSleepPrevention(reason);
        }
    }

    public allowSleep(): void {
        if (!this.isPreventingSleep) {
            return;
        }

        try {
            const platform = os.platform();
            console.log(`[PowerSaveManager] Allowing sleep on ${platform}`);
            
            switch (platform) {
                case 'darwin': // macOS
                    if (this.sleepProcess) {
                        exec('pkill caffeinate');
                        this.sleepProcess = null;
                    }
                    break;
                    
                case 'win32': // Windows
                    exec('powercfg -change -standby-timeout-ac 10'); // Reset to 10 minutes
                    break;
                    
                case 'linux': // Linux
                    // Linux inhibit automatically ends with process
                    break;
            }
            
            this.isPreventingSleep = false;
            console.log('[PowerSaveManager] Sleep allowed again');
            
        } catch (error) {
            console.warn('[PowerSaveManager] Error allowing sleep:', error);
        }
    }

    private fallbackSleepPrevention(reason: string): void {
        console.log(`[PowerSaveManager] Using fallback sleep prevention for: ${reason}`);
        vscode.window.showWarningMessage(
            `Kodelens: For best indexing performance, please adjust system power settings to prevent sleep. Current operation: ${reason}`
        );
    }

    public isSleepPrevented(): boolean {
        return this.isPreventingSleep;
    }
}