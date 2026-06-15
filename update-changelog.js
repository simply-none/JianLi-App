// update-changelog.js
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const REPO_PATH = '.';
const OUTPUT_FILE = 'CHANGELOG.md';
const REPO_URL = 'https://github.com/simply-none/JianLi-App';
const UNRELEASED_TITLE = 'Latest';

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
    const fullCmd = ['git', command, ...args].join(' ');
    return execSync(fullCmd, {
      cwd: path.resolve(REPO_PATH),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    }).trim();
  } catch (error) {
    if (error.status === 128 && command === 'log') {
      console.warn(`Git command warning: ${error.message}`);
      return '';
    }
    throw error;
  }
}

/**
 * 获取所有以 v 开头的标签，按语义化版本倒序排列
 * @returns {string[]} 排序后的标签数组
 */
function getSortedTags() {
  const allTagsStr = runGitCommand('tag', ['-l']);
  if (!allTagsStr) {
    console.warn('未找到任何 Git 标签');
    return [];
  }

  const tags = allTagsStr.split('\n')
    .map(t => t.trim())
    .filter(t => t.startsWith('v'));

  tags.sort((a, b) => compareVersions(b, a));

  if (tags.length === 0) {
    console.warn('未找到任何以 v 开头的有效标签');
  }

  return tags;
}

/**
 * 获取指定范围内的提交日志行
 * @param {string} range - git log 的范围参数，如 'v1.0.0..v1.1.0' 或 'v1.0.0..HEAD'
 * @returns {string[]} 提交日志行数组，每行格式为 'hash|message'
 */
function getCommitLines(range) {
  try {
    const logOutput = runGitCommand('log', [range, '--no-merges', '--pretty=format:"%H|%s"']);
    if (!logOutput) return [];
    return logOutput.split('\n').filter(line => line.trim() !== '');
  } catch {
    return [];
  }
}

/**
 * 获取指定 ref 的日期 (YYYY-MM-DD)
 * @param {string} ref - git ref (tag 或 commit hash)
 * @returns {string} 日期字符串
 */
function getRefDate(ref) {
  const res = runGitCommand('log', ['-1', '--format=%ai', ref]);
  return res.split(' ')[0];
}

/**
 * 将提交行解析并分类
 * @param {string[]} lines - 提交日志行数组
 * @returns {Object} 分类后的提交对象 { category: [{ desc, hash, fullHash }] }
 */
function categorizeCommits(lines) {
  const categorized = {};
  const commitRegex = /^(\w+)(?:\(([\w\-\.]+)\))?:\s*(.+)$/;
  // 匹配纯版本号提交（如 "26.6.11-rc.4"、"v1.2.3"），用于从 chore 中过滤掉版本标记提交
  const versionTagRegex = /^v?\d+\.\d+\.\d+(-[\w.]+)?$/;

  for (const rawLine of lines) {
    // 去除 git log format 包裹的引号
    const line = rawLine.replace(/^"|"$/g, '');
    const parts = line.split('|');
    if (parts.length < 2) continue;

    const hash = parts[0].substring(0, 7);
    const fullHash = parts[0];
    const message = parts.slice(1).join('|').trim();

    const match = message.match(commitRegex);

    if (match) {
      const [, type, , desc] = match;
      const normalizedType = type.toLowerCase();
      const category = TYPE_MAP[normalizedType] || TYPE_MAP['chore'];
      // chore 类型中跳过纯版本标记提交（如 chore(release): 26.6.11-rc.4）
      if (normalizedType === 'chore' && versionTagRegex.test(desc.trim())) continue;
      if (!categorized[category]) categorized[category] = [];
      categorized[category].push({ desc, hash, fullHash });
    } else {
      // 跳过纯版本标记提交
      if (versionTagRegex.test(message)) continue;
      const choreCategory = TYPE_MAP['chore'];
      if (!categorized[choreCategory]) categorized[choreCategory] = [];
      categorized[choreCategory].push({ desc: message, hash, fullHash });
    }
  }

  return categorized;
}

/**
 * 将分类后的提交渲染为 Markdown 片段
 * @param {Object} categorized - 分类后的提交对象
 * @returns {string} Markdown 字符串
 */
function renderCategorizedMarkdown(categorized) {
  let md = '';

  // 按预定义顺序输出
  for (const cat of ORDER) {
    if (categorized[cat]) {
      md += `### ${cat}\n\n`;
      categorized[cat].forEach(item => {
        md += `* ${item.desc} ([${item.hash}](${REPO_URL}/commit/${item.fullHash}))\n`;
      });
      md += '\n';
    }
  }

  // 输出其他未定义顺序的分类
  for (const cat in categorized) {
    if (!ORDER.includes(cat)) {
      md += `### ${cat}\n\n`;
      categorized[cat].forEach(item => {
        md += `* ${item.desc} ([${item.hash}](${REPO_URL}/commit/${item.fullHash}))\n`;
      });
      md += '\n';
    }
  }

  return md;
}

/**
 * 渲染单个版本区块（标题 + 分类提交）
 * @param {string} title - 版本标题（如 'v1.2.0' 或 'Latest | 最新'）
 * @param {string} compareUrl - 比较链接
 * @param {string} date - 日期字符串
 * @param {string[]} lines - 提交日志行
 * @returns {string|null} Markdown 字符串，无提交时返回 null
 */
function renderVersionSection(title, compareUrl, date, lines) {
  if (!lines.length) return null;

  const categorized = categorizeCommits(lines);
  let md = `## [${title}](${compareUrl}) (${date})\n\n`;
  md += renderCategorizedMarkdown(categorized);
  return md;
}

/**
 * 检查最新标签之后是否有未发布的提交
 * @param {string} latestTag - 最新的标签名
 * @returns {boolean}
 */
function hasUnreleasedCommits(latestTag) {
  try {
    const output = runGitCommand('rev-list', [`${latestTag}..HEAD`, '--count']);
    return parseInt(output, 10) > 0;
  } catch {
    return false;
  }
}

async function generateChangelog() {
  console.log('🚀 开始生成 CHANGELOG...');
  console.log('工作目录:', path.resolve(REPO_PATH));

  // 1. 获取排序后的标签
  let allTags;
  try {
    allTags = getSortedTags();
  } catch (e) {
    console.error('获取标签失败:', e.message);
    return;
  }

  if (allTags.length === 0) return;

  let markdown = '# CHANGELOG.md\n\n变更日志\n\n';

  // 2. 处理最新标签之后的未发布提交
  const latestTag = allTags[0];
  if (hasUnreleasedCommits(latestTag)) {
    const range = `${latestTag}..HEAD`;
    const lines = getCommitLines(range);
    const date = getRefDate('HEAD');
    const compareUrl = `${REPO_URL}/compare/${latestTag}...HEAD`;

    const section = renderVersionSection(UNRELEASED_TITLE, compareUrl, date, lines);
    if (section) {
      markdown += section;
      console.log(`  📦 最新 (${latestTag}..HEAD)，共 ${lines.length} 条提交`);
    }
  }

  // 3. 处理各标签版本的提交
  for (let i = 0; i < allTags.length; i++) {
    const currentTag = allTags[i];
    const previousTag = i + 1 < allTags.length ? allTags[i + 1] : null;

    try {
      const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
      const lines = getCommitLines(range);

      if (!lines.length) {
        console.log(`  ⚠️ 版本 ${currentTag} 没有有效的非合并提交，跳过。`);
        continue;
      }

      const date = getRefDate(currentTag);
      const comparePath = previousTag ? `${previousTag}...${currentTag}` : currentTag;
      const compareUrl = `${REPO_URL}/compare/${comparePath}`;

      const section = renderVersionSection(currentTag, compareUrl, date, lines);
      if (section) {
        markdown += section;
      }
    } catch (e) {
      console.error(`❌ Error processing tag ${currentTag}:`, e.message);
    }
  }

  // 4. 写入文件
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