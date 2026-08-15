/**
 * 通用条件查询
 * @param {string} tableName 表名
 * @param {object} conditions 条件对象 {字段:值}
 * @param {function} callback 回调函数(err, rows)
 */
import { Database } from "sqlite3";
export declare function queryByConditions({ db, tableName, conditions, callback }: {
    db: any;
    tableName: any;
    conditions: any;
    callback: any;
}): void;
export declare function createTable({ db, tableName, config, callback }: {
    db: any;
    tableName: any;
    config: any;
    callback: any;
}): Promise<void>;
export declare function upsertData({ db, tableName, data, config, callback, }: {
    db: Database;
    tableName: string;
    data: Record<string, any> | Record<string, any>[];
    config?: {
        primaryKey?: string;
    };
    callback: (err: Error | null, result: any) => void;
}): Promise<void>;
export declare function deleteData({ db, tableName, condition, callback }: {
    db: any;
    tableName: any;
    condition: any;
    callback: any;
}): Promise<any>;
