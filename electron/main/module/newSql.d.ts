/**
 * 高性能 SQLite 数据库操作模块
 *
 * 本模块基于 sqlite3 库实现，提供以下特性：
 * - WAL (Write-Ahead Logging) 模式支持，提升并发读写性能
 * - Promise 风格 API，替代回调模式
 * - 自动表创建和列扩展
 * - 事务支持
 * - IPC 通信接口，供渲染进程调用
 *
 * @module newSql
 */
import type { Database } from "sqlite3";
/**
 * 数据库实例集合
 * - db: 主数据库
 * - userDb: 用户数据库
 * - shiciDb: 诗词数据库
 */
export declare let myDb: Record<string, Database>;
/**
 * 查询选项接口
 */
interface QueryOptions {
    /** 表名 */
    tableName: string;
    /** 查询条件对象 */
    conditions?: Record<string, any>;
    /** 指定查询的列 */
    columns?: string[];
    /** 排序字段 */
    orderBy?: string;
    /** 是否降序排序 */
    orderByDesc?: boolean;
    /** 查询条数限制 */
    limit?: number;
    /** 查询偏移量 */
    offset?: number;
    /** 自定义 WHERE 条件字符串 */
    whereStr?: string;
    /** 完整的 SQL 查询语句 */
    SqlStr?: string;
}
/**
 * 插入选项接口
 */
interface InsertOptions {
    /** 表名 */
    tableName: string;
    /** 要插入的数据，支持单条或多条 */
    data: Record<string, any> | Record<string, any>[];
    /** 配置选项 */
    config?: {
        /** 主键字段名，默认为 id */
        primaryKey?: string;
    };
}
/**
 * 更新选项接口
 */
interface UpdateOptions {
    /** 表名 */
    tableName: string;
    /** 要更新的数据 */
    data: Record<string, any>;
    /** 更新条件 */
    condition: Record<string, any>;
}
/**
 * 删除选项接口
 */
interface DeleteOptions {
    /** 表名 */
    tableName: string;
    /** 删除条件 */
    condition: Record<string, any>;
}
/**
 * 事务选项接口
 */
interface TransactionOptions {
    /** 要执行的 SQL 语句数组 */
    sqls: string[];
    /** 对应的参数数组 */
    params?: any[][];
}
/**
 * 初始化 SQLite 数据库
 *
 * 执行流程：
 * 1. 创建数据库文件（如果不存在）
 * 2. 初始化 WAL 模式以提升并发性能
 *
 * @returns {Promise<void>}
 */
export declare function initNewSqlite(): Promise<void>;
/**
 * 查询数据
 *
 * 支持多种查询方式：
 * 1. 完整 SQL 语句查询（SqlStr）
 * 2. 条件对象查询（conditions）
 * 3. 自定义 WHERE 字符串查询（whereStr）
 *
 * 自动确保表存在，支持排序、分页。
 *
 * @param {QueryOptions} options - 查询选项
 * @returns {Promise<any[]>} 查询结果数组
 */
export declare function query(options: QueryOptions): Promise<any[]>;
/**
 * 计数查询
 *
 * 查询表中满足条件的记录数。
 *
 * @param {string} tableName - 表名
 * @param {Record<string, any>} [condition] - 查询条件
 * @returns {Promise<number>} 记录数量
 */
export declare function count(tableName: string, condition?: Record<string, any>): Promise<number>;
/**
 * 插入数据
 *
 * 支持单条和批量插入，自动确保表和列存在。
 * 使用事务保证批量插入的原子性。
 *
 * @param {InsertOptions} options - 插入选项
 * @returns {Promise<{ lastID: number; changes: number }>} 插入结果
 * @throws {Error} 当数据为空时抛出异常
 */
export declare function insert(options: InsertOptions): Promise<{
    lastID: number;
    changes: number;
}>;
/**
 * 插入或更新数据 (Upsert)
 *
 * 使用 SQLite 的 ON CONFLICT 语法实现插入或更新。
 * 当主键冲突时自动更新已有记录。
 *
 * @param {InsertOptions} options - 插入选项
 * @returns {Promise<{ lastID: number; changes: number }>} 操作结果
 * @throws {Error} 当数据为空时抛出异常
 */
export declare function upsert(options: InsertOptions): Promise<{
    lastID: number;
    changes: number;
}>;
/**
 * 更新数据
 *
 * 根据条件更新表中的记录。
 *
 * @param {UpdateOptions} options - 更新选项
 * @returns {Promise<{ changes: number }>} 更新结果
 * @throws {Error} 当数据为空或条件为空时抛出异常
 */
export declare function update(options: UpdateOptions): Promise<{
    changes: number;
}>;
/**
 * 删除数据
 *
 * 根据条件删除表中的记录。
 *
 * @param {DeleteOptions} options - 删除选项
 * @returns {Promise<{ changes: number }>} 删除结果
 * @throws {Error} 当条件为空时抛出异常
 */
export declare function del(options: DeleteOptions): Promise<{
    changes: number;
}>;
/**
 * 执行任意 SQL 语句
 *
 * 支持 SELECT/INSERT/UPDATE/DELETE 等所有 SQL 语句。
 * 自动提取表名和列名，确保表和列存在。
 * 如果执行失败且原因是缺少列，会自动添加列并重试。
 *
 * @param {string} sql - SQL 语句
 * @param {any[]} [params] - SQL 参数
 * @param {string} [primaryKey='id'] - 主键字段名，默认为 id
 * @returns {Promise<{ lastID: number; changes: number; rows?: any[] }>} 执行结果
 */
export declare function execute(sql: string, params?: any[], primaryKey?: string): Promise<{
    lastID: number;
    changes: number;
    rows?: any[];
}>;
/**
 * 获取 SQL 执行计划
 *
 * 使用 EXPLAIN QUERY PLAN 分析 SQL 查询的执行计划，帮助优化查询性能。
 *
 * @param {string} sql - SQL 查询语句
 * @returns {Promise<any[]>} 执行计划结果
 */
export declare function explain(sql: string): Promise<any[]>;
/**
 * 执行事务
 *
 * 在事务中执行多条 SQL 语句，保证原子性。
 * 任意一条语句失败则回滚所有操作。
 *
 * @param {TransactionOptions} options - 事务选项
 * @returns {Promise<{ success: boolean; results?: any[] }>} 事务执行结果
 */
export declare function transaction(options: TransactionOptions): Promise<{
    success: boolean;
    results?: any[];
}>;
/**
 * 确保表存在
 *
 * 如果表不存在则自动创建，支持指定初始列和自定义主键。
 * 如果表已存在但缺少指定列，会自动添加。
 *
 * @param {string} tableName - 表名
 * @param {string[]} [columns] - 需要确保存在的列名数组
 * @param {string} [primaryKey='id'] - 主键字段名，默认为 id
 * @returns {Promise<void>}
 */
export declare function ensureTableExists(tableName: string, columns?: string[], primaryKey?: string): Promise<void>;
export {};
