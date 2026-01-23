const { app } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 模拟数据库环境
const userDataPath = app?.getPath("documents") || path.join(__dirname, 'test-data');
const testDbPath = path.join(userDataPath, 'concurrency_test.sqlite');

// 确保测试目录存在
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

// 创建测试数据库
const db = new sqlite3.Database(testDbPath);

// 导入优化后的 upsertData 方法
const { upsertData } = require('../electron/main/utils/sql.ts');

// 创建测试表
db.run(`
  CREATE TABLE IF NOT EXISTS concurrent_test (
    id INTEGER PRIMARY KEY,
    name TEXT,
    value INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 并发测试函数
async function runConcurrentTest() {
  console.log('开始并发upsert测试...');
  
  const testCount = 20; // 并发操作次数
  const promises = [];
  
  for (let i = 0; i < testCount; i++) {
    const promise = new Promise((resolve, reject) => {
      const testData = {
        id: 1, // 相同ID以测试冲突处理
        name: `test-${i}`,
        value: Math.floor(Math.random() * 1000)
      };
      
      upsertData({
        db: db,
        tableName: 'concurrent_test',
        data: testData,
        config: { primaryKey: 'id' },
        callback: (err, result) => {
          if (err) {
            console.error(`操作 ${i} 失败:`, err.message);
            reject(err);
          } else {
            console.log(`操作 ${i} 成功`);
            resolve(result);
          }
        }
      });
    });
    
    promises.push(promise);
    
    // 添加随机延迟以模拟真实并发
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  
  try {
    await Promise.all(promises);
    console.log('✅ 所有并发操作完成！');
    
    // 验证结果
    db.get('SELECT COUNT(*) as count FROM concurrent_test', (err, row) => {
      if (err) {
        console.error('验证失败:', err);
      } else {
        console.log(`最终记录数: ${row.count} (应为1，因为所有操作更新同一条记录)`);
      }
      
      // 清理
      db.close();
      fs.unlinkSync(testDbPath);
      console.log('测试完成，数据库已清理');
    });
    
  } catch (error) {
    console.error('❌ 并发测试失败:', error);
    db.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

// 运行测试
runConcurrentTest().catch(console.error);