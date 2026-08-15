export interface StartupResult {
    success: boolean;
    method: string;
    message?: string;
}
export declare function setAutoStartup(isStartup: boolean): StartupResult;
export declare function checkAutoStartupStatus(): boolean;
