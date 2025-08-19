import DateBase from 'better-sqlite3'
import { app } from 'electron';
import {fileURLToPath} from 'url';

const __filename = fileURLToPath(import.meta.url);
global.__filename = __filename;
export let db;

export function initDB() {
  // 获取用户目录
  const userDataPath = app.getPath("userData");
  // 创建数据库
  db = new DateBase(`${userDataPath}/database.db`);
  // 创建表
  db.exec(`CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY, key TEXT, value TEXT)`);

  // 初始化数据
  const config = db.prepare("SELECT * FROM config WHERE key = ?").get("config");
  if (!config) {
    db.prepare("INSERT INTO config (key, value) VALUES (?, ?)").run("config", JSON.stringify({}));
  }

  // 获取所有数据
  const allConfig = db.prepare("SELECT * FROM config").all();
  console.log(allConfig);
}