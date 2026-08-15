import type { Database } from "sqlite3";
export declare let myDb: Record<string, Database>;
export declare function initSqlite(): Promise<void>;
export declare function initSqliteFn(dbName: any, isDefault?: boolean): void;
