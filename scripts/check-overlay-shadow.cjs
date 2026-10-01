/**
 * 临时自证脚本：编译 src/style.scss 并断言浮层投影 token 链路完整。
 * 1) 26 个主题块都定义了 --shadow-dialog / --shadow-popover（theme.md 红线 4：全主题同名）
 * 2) element-plus-theme.scss 把 --el-box-shadow* 重映射到新 token
 * 3) style.scss 的 dialog / message-box / tooltip / table 固定列规则正确消费 token
 * 用法：node scripts/check-overlay-shadow.cjs
 */
const fs = require('fs');
const path = require('path');
const sass = require('sass');

const fail = (msg) => {
  console.error('ASSERT FAIL:', msg);
  process.exit(1);
};

// 1) 主题文件 token 齐全性
const themesDir = path.resolve(__dirname, '../src/styles/themes');
let blocks = 0;
for (const file of fs.readdirSync(themesDir).sort()) {
  if (!file.endsWith('.scss') || file === 'index.scss') continue;
  const src = fs.readFileSync(path.join(themesDir, file), 'utf8');
  const nDialog = (src.match(/--shadow-dialog:/g) || []).length;
  const nPopover = (src.match(/--shadow-popover:/g) || []).length;
  const nBg = (src.match(/--bg-base:/g) || []).length;
  if (nDialog !== nBg || nPopover !== nBg) {
    fail(`${file}: --bg-base ${nBg} 处，但 --shadow-dialog ${nDialog} / --shadow-popover ${nPopover}，数量不一致`);
  }
  blocks += nBg;
}
console.log(`OK 主题 token 齐全：${blocks} 个主题块均定义 --shadow-dialog / --shadow-popover`);
if (blocks !== 26) fail(`主题块数量 ${blocks} ≠ 26`);

// 2) 编译 style.scss（含 element-plus-theme.scss）
const aliasImporter = {
  findFileUrl(url) {
    if (url.startsWith('@/')) {
      return new URL('file://' + path.resolve(__dirname, '../src', url.slice(2)).split(path.sep).join('/'));
    }
    return null;
  },
};
const css = sass.compile('src/style.scss', { importers: [aliasImporter], quietDeps: true }).css;
console.log('OK sass 编译通过，', css.length, 'bytes');

// 按选择器取规则体（取「最后一条」匹配，模拟层叠胜出）
const ruleOf = (selector) => {
  let hit = null;
  let idx = -1;
  while ((idx = css.indexOf(selector, idx + 1)) !== -1) {
    hit = css.slice(idx, css.indexOf('}', idx) + 1);
  }
  return hit;
};

const dlg = ruleOf('.el-dialog {');
if (!dlg || !dlg.includes('box-shadow: var(--shadow-dialog)')) fail('.el-dialog 未消费 --shadow-dialog');
if (!dlg.includes('border: 1px solid var(--border-subtle)')) fail('.el-dialog 缺边框');

const mb = ruleOf('.el-message-box {');
if (!mb || !mb.includes('box-shadow: var(--shadow-dialog)')) fail('.el-message-box 未消费 --shadow-dialog');

const tip = ruleOf('.el-tooltip__popper {');
if (!tip || !tip.includes('box-shadow: var(--shadow-popover)')) fail('.el-tooltip__popper 未消费 --shadow-popover');

const table = ruleOf('.el-table {');
if (!table || !table.includes('--el-table-fixed-box-shadow: var(--shadow-top)')) fail('.el-table 固定列阴影未兜回');

// 3) 重映射层
if (!css.includes('--el-box-shadow: var(--shadow-dialog)')) fail('element-plus-theme 未重映射 --el-box-shadow');
if (!css.includes('--el-box-shadow-light: var(--shadow-popover)')) fail('element-plus-theme 未重映射 --el-box-shadow-light');
if (!css.includes('--el-box-shadow-dark: var(--shadow-dialog)')) fail('element-plus-theme 未重映射 --el-box-shadow-dark');

// 4) 抽查一套亮主题 + 一套暗主题的 token 值
if (!css.includes('--shadow-dialog: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12)')) {
  fail('暗色变体 token 值未出现在编译产物');
}
if (!css.includes('--shadow-dialog: 0 8px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.1)')) {
  fail('亮色变体 token 值未出现在编译产物');
}

console.log('ASSERT OK：dialog / message-box / tooltip / 表格固定列 / 重映射层 / 26 主题块 全部通过');
