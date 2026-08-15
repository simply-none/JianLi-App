import ElectronStore from "electron-store";
export declare let store: ElectronStore<Record<string, unknown>>;
export declare const tableName = "basic_info";
export declare function getAllStore(): ObjectType;
export interface PomodoroStatus {
    isResting: boolean;
    startWorkTime: number;
    closeWorkTime: number;
}
export declare function getPomodoroStatus(): Promise<PomodoroStatus>;
export declare function setPomodoroToWork(force?: boolean): Promise<void>;
export declare function initStore(): void;
