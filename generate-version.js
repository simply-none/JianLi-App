import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function getCurrentVersion() {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2); // YY 格式
  const month = (date.getMonth() + 1).toString(); // M 格式(不补零)
  const day = date.getDate().toString(); // D 格式(不补零)
  
  return `${year}.${month}.${day}`;
}

function getLatestRCVersion(baseVersion) {
  try {
    // 读取 package.json 获取当前版本
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      return `${baseVersion}-rc.1`;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const currentVersion = packageJson.version || '';
    
    // 检查当前版本是否与基础版本匹配
    if (currentVersion.startsWith(`${baseVersion}-rc.`)) {
      const rcNumber = parseInt(currentVersion.split('-rc.')[1]);
      if (!isNaN(rcNumber)) {
        return `${baseVersion}-rc.${rcNumber + 1}`;
      }
    }
    
    // 如果没有匹配的版本或解析失败，从 rc.1 开始
    return `${baseVersion}-rc.1`;
  } catch (error) {
    console.warn('无法读取当前版本信息:', error.message);
    return `${baseVersion}-rc.1`;
  }
}

/**
 * 手动创建提交并打标签
 * 将 npm run release 过程中所有修改的文件（CHANGELOG.md、package.json 等）一起提交
 */
function createCommitAndTag(newVersion) {
  // 暂存所有已修改的文件
  execSync('git add -A', { stdio: 'inherit' });
  
  // 创建版本提交
  execSync(`git commit -m "chore(release): ${newVersion}"`, { stdio: 'inherit' });
  
  // 创建版本标签
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
  
  console.log(`✅ 已创建提交和标签: v${newVersion}`);
}

function updateVersion() {
  try {
    const baseVersion = getCurrentVersion();
    const newVersion = getLatestRCVersion(baseVersion);
    
    console.log(`基础版本号: ${baseVersion}`);
    console.log(`生成新版本号: ${newVersion}`);
    
    // 使用 standard-version 仅更新版本号（跳过提交、标签、changelog）
    execSync(`npx standard-version --release-as ${newVersion} --skip.commit=true --skip.tag=true --skip.changelog=true`, {
      stdio: 'inherit'
    });
    
    console.log('版本号已更新');
    
    // 手动提交所有变更并打标签
    createCommitAndTag(newVersion);
    
    return newVersion;
  } catch (error) {
    console.error('版本更新失败:', error.message);
    throw error;
  }
}

// 入口函数
function main() {
  console.log('开始更新版本号...');
  try {
    const version = updateVersion();
    console.log(`最终版本号: ${version}`);
  } catch (error) {
    process.exit(1);
  }
}

main();
