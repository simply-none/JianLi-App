import { BrowserWindow } from "electron";
export declare let win: BrowserWindow | null;
export declare function focusAppToTop(): void;
export declare function isSetStartup(isStartup: boolean, hidden?: boolean): import("./autoStartup.ts").StartupResult;
export declare function hideApp(): void;
export declare function exitApp(): void;
export declare function initMainWindow(): void;
