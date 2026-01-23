// 简单的并发测试脚本 (CommonJS 格式)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 创建测试数据库
const testDbPath = path.join(__dirname, 'test_concurrency.db');
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}

const db = new sqlite3.Database(testDbPath);

// 创建测试表
db.run(`
  CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    name TEXT,
    value INTEGER
  )
`, () => {
  console.log('测试表创建完成');
  
  // 模拟 upsertData 的核心逻辑
  function simulateUpsert(operationId) {
    return new Promise((resolve, reject) => {
      const testData = {
        id: 1, // 相同ID制造冲突
        name: `op-${operationId}`,
        value: operationId
      };
      
      const sql = `
        INSERT INTO test_table (id, name, value) 
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
        name=excluded.name, value=excluded.value
      `;
      
      // 使用 IMMEDIATE 事务
      db.run("BEGIN IMMEDIATE TRANSACTION", (beginErr) => {
        if (beginErr) {
          console.log(`操作 ${operationId}: 事务开始失败 -`, beginErr.message);
          // 重试逻辑
          setTimeout(() => simulateUpsert(operationId).then(resolve).catch(reject), 100);
          return;
        }
        
        // 执行插入/更新
        db.run(sql, [testData.id, testData.name, testData.value], function(runErr) {
          if (runErr) {
            console.log(`操作 ${operationId}: 执行失败 -`, runErr.message);
            // 回滚并重试
            db.run("ROLLBACK", () => {
              setTimeout(() => simulateUpsert(operationId).then(resolve).catch(reject), 100);
            });
            return;
          }
          
          // 提交事务
          db.run("COMMIT", (commitErr) => {
            if (commitErr) {
              console.log(`操作 ${operationId}: 提交失败 -`, commitErr.message);
              db.run("ROLLBACK", () => {
                setTimeout(() => simulateUpsert(operationId).then(resolve).catch(reject), 100);
              });
            } else {
              console.log(`操作 ${operationId}: 成功完成`);
              resolve();
            }
          });
        });
      });
    });
  }

  // 运行并发测试
  const concurrentOperations = 10;
  const promises = [];
  
  console.log(`开始 ${concurrentOperations} 个并发操作...`);
  
  for (let i = 0; i < concurrentOperations; i++) {
    promises.push(simulateUpsert(i));
    
    // 添加一些延迟来模拟真实并发
    if (i % 3 === 0) {
      new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  Promise.all(promises)
    .then(() => {
      console.log('所有操作完成！');
      
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
          fs.unlinkSync(testDbPath);
        }
      });
    })
    .catch(error => {
      console.error('并发测试失败:', error);
      db.close();
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    });
});