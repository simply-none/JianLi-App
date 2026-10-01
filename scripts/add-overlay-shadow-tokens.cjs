/**
 * 临时脚本：给全部主题文件注入浮层投影 token --shadow-dialog / --shadow-popover。
 * 规则（theme.md 红线 4：新颜色语义必须在每套主题 + light.scss :root 同时定义）：
 *  - 扫描 src/styles/themes/*.scss（跳过 index.scss 聚合器）里每一行 `--bg-base: <color>;`
 *  - 按底色亮度判定亮/暗：暗色变体带「亮色描边圈」（深背景上黑影不可见，靠细亮圈分边界）
 *  - 插在该行之后，缩进与原行对齐；已含 --shadow-dialog 的文件跳过（幂等）
 * 用法：node scripts/add-overlay-shadow-tokens.cjs
 */
const fs = require('fs');
const path = require('path');

const THEMES_DIR = path.resolve(__dirname, '../src/styles/themes');

const LIGHT = [
  '/* 浮层投影 token：模态层（el-dialog / message-box）用 --shadow-dialog，轻浮层（popover / 下拉 / 通知）用 --shadow-popover */',
  '--shadow-dialog: 0 8px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.1);',
  '--shadow-popover: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06);',
];
const DARK = [
  '/* 浮层投影 token：模态层用 --shadow-dialog，轻浮层用 --shadow-popover；暗色底黑影不可见，描边圈负责分边界 */',
  '--shadow-dialog: 0 12px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.12);',
  '--shadow-popover: 0 6px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);',
];

/** 解析 #rgb/#rrggbb/#rrggbbaa/rgb()/rgba() → 亮度 0~255（加权平均） */
function luminance(str) {
  const s = str.trim().toLowerCase();
  let r, g, b;
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else if ((m = s.match(/^#([0-9a-f]{6})/))) {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  } else if ((m = s.match(/rgba?\(([^)]+)\)/))) {
    const parts = m[1].split(',').map((x) => parseFloat(x));
    [r, g, b] = parts;
  } else {
    throw new Error('无法解析颜色: ' + str);
  }
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

let totalBlocks = 0;
for (const file of fs.readdirSync(THEMES_DIR).sort()) {
  if (!file.endsWith('.scss') || file === 'index.scss') continue;
  const fp = path.join(THEMES_DIR, file);
  let src = fs.readFileSync(fp, 'utf8');
  if (src.includes('--shadow-dialog')) {
    console.log(`SKIP  ${file}（已有 token）`);
    continue;
  }
  const lines = src.split('\n');
  const out = [];
  let inserted = 0;
  for (const line of lines) {
    out.push(line);
    const m = line.match(/^(\s*)--bg-base:\s*([^;]+);/);
    if (m) {
      const isDark = luminance(m[2]) < 128;
      const indent = m[1];
      const variant = (isDark ? DARK : LIGHT).map((l) => (l.startsWith('--') || l.startsWith('/*') ? indent + l : l));
      out.push(...variant);
      inserted++;
      totalBlocks++;
      console.log(`  ${file}: bg-base=${m[2].trim()} → ${isDark ? 'DARK' : 'LIGHT'} 变体`);
    }
  }
  if (inserted === 0) {
    console.error(`ASSERT FAIL: ${file} 里没找到 --bg-base`);
    process.exit(1);
  }
  fs.writeFileSync(fp, out.join('\n'));
  console.log(`OK    ${file}（注入 ${inserted} 处）`);
}
console.log(`共注入 ${totalBlocks} 个主题块`);
