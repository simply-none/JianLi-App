// update-changelog.js
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_PATH = '.';
const OUTPUT_FILE = 'CHANGELOG.md';
const REPO_URL = 'https://github.com/simply-none/JianLi-App';

// 类型映射
const TYPE_MAP = {
  feat: '✨ Features | 新功能',
  fix: '🐛 Bug Fixes | Bug 修复',
  perf: '⚡ Performance Improvements | 性能优化',
  refactor: '♻️ Code Refactoring | 代码重构',
  style: '💄 Styles | 样式更改',
  test: '✅ Tests | 测试',
  chore: '🔧 Chores | 其他杂项',
  docs: '📝 Documentation | 文档更新',
  ci: '👷 CI/CD | 持续集成',
  build: '📦 Build System | 构建系统',
  revert: '⏪ Reverts | 回退'
};

// 期望的输出顺序
const ORDER = [
  '✨ Features | 新功能',
  '🐛 Bug Fixes | Bug 修复',
  '⚡ Performance Improvements | 性能优化',
  '♻️ Code Refactoring | 代码重构',
  '💄 Styles | 样式更改',
  '📝 Documentation | 文档更新',
  '🔧 Chores | 其他杂项',
  '✅ Tests | 测试',
  '👷 CI/CD | 持续集成',
  '📦 Build System | 构建系统',
  '⏪ Reverts | 回退'
];

/**
 * 执行 Git 命令并返回字符串结果
 * @param {string} command - git 子命令 (如 'tag', 'log')
 * @param {string[]} args - 参数列表
 * @param {object} options - execSync 选项
 */
function runGitCommand(command, args = [], options = {}) {
  try {
    // 构建完整命令: git command ...args
    // cwd 确保在正确的目录下执行
    const fullCmd = ['git', command, ...args].join(' ');
    return execSync(fullCmd, {
      cwd: path.resolve(REPO_PATH),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'], // 捕获 stdout 和 stderr
      ...options
    }).trim();
  } catch (error) {
    // 如果命令出错（例如没有标签），返回空字符串或抛出错误，视情况而定
    if (error.status === 128 && command === 'log') {
       // 某些 log 范围查询如果没有提交可能会报错，视具体错误处理
       console.warn(`Git command warning: ${error.message}`);
       return '';
    }
    throw error;
  }
}

async function generateChangelog() {
  console.log('🚀 开始生成 CHANGELOG...');
  console.log('工作目录:', path.resolve(REPO_PATH));

  // 获取所有标签
  let allTagsStr = '';
  try {
    allTagsStr = runGitCommand('tag', ['-l']);
  } catch (e) {
    console.error('获取标签失败:', e.message);
    return;
  }

  if (!allTagsStr) {
    console.warn('未找到任何 Git 标签');
    return;
  }

  // 过滤并以 v 开头的标签
  let allTags = allTagsStr.split('\n')
    .map(t => t.trim())
    .filter(t => t.startsWith('v'));
  
  // 语义化版本排序 (倒序: 新 -> 旧)
  allTags.sort((a, b) => compareVersions(b, a));

  if (allTags.length === 0) {
    console.warn('未找到任何以 v 开头的有效标签');
    return;
  }

  let markdown = '# CHANGELOG.md\n\n变更日志\n\n';

  for (let i = 0; i < allTags.length; i++) {
    const currentTag = allTags[i];
    const previousTag = i + 1 < allTags.length ? allTags[i + 1] : null;
    
    try {
      // 2. 获取两个标签之间的提交日志
      // 格式: Hash|Subject
      const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
      
      // 使用原生命令获取日志
      // --no-merges: 忽略合并提交
      // --pretty=format:%H|%s: 自定义输出格式
      let logOutput = '';
      try {
        logOutput = runGitCommand('log', [range, '--no-merges', '--pretty=format:"%H|%s"']);
      } catch (e) {
        // 如果范围内没有提交，git log 可能退出码非0，这里捕获并视为空
        logOutput = '';
      }

      if (!logOutput) {
        console.log(`  ⚠️ 版本 ${currentTag} 没有有效的非合并提交，跳过。`);
        continue;
      }

      // 将输出按行分割
      const lines = logOutput.split('\n').filter(line => line.trim() !== '');
      
      // 3. 获取该 tag 的日期
      // 取该 tag 指向的 commit 的日期
      const tagDateRes = runGitCommand('log', ['-1', '--format=%ai', currentTag]);
      const date = tagDateRes.split(' ')[0]; // YYYY-MM-DD

      // 构建头部链接
      const comparePath = previousTag ? `${previousTag}...${currentTag}` : currentTag;
      const compareUrl = `${REPO_URL}/compare/${comparePath}`;
      
      markdown += `## [${currentTag}](${compareUrl}) (${date})\n\n`;

      // 分类提交
      const categorized = {};
      
      for (const line of lines) {
        // line 格式: "commit_hash|commit_message"
        const parts = line.split('|');
        if (parts.length < 2) continue;
        
        const hash = parts[0].substring(0, 7);
        const fullHash = parts[0];
        // 消息中可能包含 |，所以要把剩余部分拼回去
        const message = parts.slice(1).join('|'); 
        
        // 匹配 conventional commits: type(scope): description
        const commitRegex = /^(\w+)(?:\(([\w\-\.]+)\))?:\s*(.+)$/;
        const match = message.match(commitRegex);
        
        if (match) {
          const [, type, , desc] = match;
          const normalizedType = type.toLowerCase();
          const category = TYPE_MAP[normalizedType] || TYPE_MAP['chore'];
          
          if (!categorized[category]) {
            categorized[category] = [];
          }
          
          categorized[category].push({
            desc,
            hash,
            fullHash,
          });
        } else {
           // 非规范提交归类为 Chores
           if (!categorized[TYPE_MAP['chore']]) {
            categorized[TYPE_MAP['chore']] = [];
          }
          categorized[TYPE_MAP['chore']].push({
            desc: message,
            hash,
            fullHash,
          });
        }
      }

      // 4. 按指定顺序输出
      for (const cat of ORDER) {
        if (categorized[cat]) {
          markdown += `### ${cat}\n\n`;
          categorized[cat].forEach(item => {
            markdown += `* ${item.desc} ([${item.hash}](${REPO_URL}/commit/${item.fullHash}))\n`;
          });
          markdown += '\n';
        }
      }
      
      // 输出其他未定义顺序的分类 (如果有)
      for (const cat in categorized) {
        if (!ORDER.includes(cat)) {
           markdown += `### ${cat}\n\n`;
           categorized[cat].forEach(item => {
            markdown += `* ${item.desc} ([${item.hash}](${REPO_URL}/commit/${item.fullHash}))\n`;
          });
          markdown += '\n';
        }
      }

    } catch (e) {
      console.error(`❌ Error processing tag ${currentTag}:`, e.message);
    }
  }

  // 5. 写入文件
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf-8');
  console.log(`\n✅ CHANGELOG.md 已更新，共处理 ${allTags.length} 个版本。`);
}

// 简单的版本比较函数 (保持不变)
function compareVersions(v1, v2) {
  const parse = (v) => {
      const cleanV = v.replace(/^v/, '');
      const parts = cleanV.split('-');
      const main = parts[0].split('.').map(Number);
      const pre = parts[1] || '';
      return { main, pre };
  }
  
  const p1 = parse(v1);
  const p2 = parse(v2);
  
  // 比较主版本号
  for (let i = 0; i < Math.max(p1.main.length, p2.main.length); i++) {
      const n1 = p1.main[i] || 0;
      const n2 = p2.main[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
  }
  
  // 主版本号相同，比较预发布版本
  if (!p1.pre && p2.pre) return 1;
  if (p1.pre && !p2.pre) return -1;
  if (!p1.pre && !p2.pre) return 0;
  
  // 都有预发布版本，字符串比较
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return collator.compare(p1.pre, p2.pre);
}

generateChangelog().catch(console.error);