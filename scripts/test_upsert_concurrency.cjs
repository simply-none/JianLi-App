// 测试 upsertData 并发性能 (CommonJS 格式)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 创建测试数据库
const testDbPath = path.join(__dirname, 'concurrency_test.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new sqlite3.Database(testDbPath);

// 模拟 upsertData 方法的核心逻辑（带互斥锁）
const dbLocks = new Map();

function getDbLock(db) {
  if (!dbLocks.has(db)) {
    dbLocks.set(db, { locked: false, queue: [] });
  }
  return dbLocks.get(db);
}

async function withDbLock(db, operation) {
  const lock = getDbLock(db);
  
  return new Promise((resolve, reject) => {
    const executeOperation = async () => {
      lock.locked = true;
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        lock.locked = false;
        if (lock.queue.length > 0) {
          const next = lock.queue.shift();
          next();
        }
      }
    };
    
    if (lock.locked) {
      lock.queue.push(executeOperation);
    } else {
      executeOperation();
    }
  });
}

async function testUpsert(operationId) {
  return withDbLock(db, async () => {
    const testData = {
      id: 1, // 相同ID制造冲突
      name: `test-${operationId}`,
      value: operationId
    };
    
    const sql = `
      INSERT INTO test_table (id, name, value) 
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
      name=excluded.name, value=excluded.value
    `;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [testData.id, testData.name, testData.value], function(err) {
        if (err) {
          console.log(`操作 ${operationId}: 失败 -`, err.message);
          reject(err);
        } else {
          console.log(`操作 ${operationId}: 成功`);
          resolve();
        }
      });
    });
  });
}

// 创建测试表
db.run(`
  CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    name TEXT,
    value INTEGER
  )
`, () => {
  console.log('测试表创建完成');
  
  // 运行并发测试
  const concurrentOperations = 20;
  const promises = [];
  
  console.log(`开始 ${concurrentOperations} 个并发操作...`);
  
  for (let i = 0; i < concurrentOperations; i++) {
    // 添加随机延迟以模拟真实并发场景
    const delay = Math.random() * 100;
    promises.push(
      new Promise(resolve => setTimeout(resolve, delay))
        .then(() => testUpsert(i))
    );
  }
  
  Promise.all(promises)
    .then(() => {
      console.log('✅ 所有并发操作完成！');
      
      // 验证结果
      db.get('SELECT * FROM test_table WHERE id = 1', (err, row) => {
        if (err) {
          console.error('验证失败:', err);
        } else if (row) {
          console.log('最终结果:', row);
          console.log('✅ 并发测试通过！只有一条记录存在');
        } else {
          console.log('❌ 没有找到记录');
        }
        
        // 清理
        db.close();
        if (fs.existsSync(testDbPath)) {
          try {
            fs.unlinkSync(testDbPath);
            console.log('测试数据库已清理');
          } catch (cleanupErr) {
            console.log('清理失败（文件可能被锁定）:', cleanupErr.message);
          }
        }
      });
    })
    .catch(error => {
      console.error('❌ 并发测试失败:', error);
      db.close();
    });
});