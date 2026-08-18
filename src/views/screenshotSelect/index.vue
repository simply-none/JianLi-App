<template>
  <div class="ss-root">
    <!-- 选区阶段：整屏冻结背景 + 透明选框 -->
    <canvas id="bg"></canvas>
    <div id="sel">
      <div class="grid"></div>
      <div class="handle nw" data-dir="nw"></div>
      <div class="handle n" data-dir="n"></div>
      <div class="handle ne" data-dir="ne"></div>
      <div class="handle e" data-dir="e"></div>
      <div class="handle se" data-dir="se"></div>
      <div class="handle s" data-dir="s"></div>
      <div class="handle sw" data-dir="sw"></div>
      <div class="handle w" data-dir="w"></div>
      <div id="sizeLabel"></div>
    </div>
    <div id="bar">
      <button class="primary" data-act="confirm">完成选区</button>
      <button data-act="full">全屏</button>
      <button data-act="cancel">取消</button>
    </div>
    <canvas id="mag" width="140" height="140"></canvas>
    <div id="hint">拖拽框选区域；单击空白处截取全屏 · Enter 完成 · Esc 取消</div>

    <!-- 标注阶段：全屏标注画布（bgImage 整屏冻结 + 标注），选区仅为可移动的遮罩窗口 -->
    <canvas id="anno"></canvas>
    <div id="editor">
      <button class="tool-btn active" data-tool="select">选择</button>
      <button class="tool-btn" data-tool="arrow">箭头</button>
      <button class="tool-btn" data-tool="rect">矩形</button>
      <button class="tool-btn" data-tool="ellipse">椭圆</button>
      <button class="tool-btn" data-tool="brush">画笔</button>
      <button class="tool-btn" data-tool="text">文字</button>
      <button class="tool-btn" data-tool="mosaic">马赛克</button>
      <button class="tool-btn" data-tool="eyedropper">吸管</button>
      <button id="undoBtn">撤回</button>
      <span class="divider"></span>
      <button class="act primary" data-act="copy">复制</button>
      <button class="act" data-act="save">保存</button>
      <button class="act" data-act="reset">重选</button>
      <button class="act" data-act="cancel">取消</button>
    </div>
    <div id="props">
      <div class="prow">
        <span class="plabel" id="fgLabel">颜色</span>
        <div id="palette" class="swatches"></div>
        <input type="color" id="customColor" value="#ff4d4f" title="自定义颜色" />
        <span id="eyedropperHex" class="eyedropper-hex" style="display:none" title="当前预览颜色，点击右侧「复制」写入剪贴板">#000000</span>
        <button id="eyedropperCopy" class="tbtn eyedropper-copy" type="button" style="display:none">复制</button>
      </div>
      <div class="prow" id="bgColorRow" style="display:none">
        <span class="plabel">背景</span>
        <div id="bgPalette" class="swatches"></div>
        <input type="color" id="bgCustomColor" value="#ffffff" title="自定义背景色" />
        <button id="bgNone" class="tbtn" title="无背景">无</button>
      </div>
      <div class="prow" id="sizeRow">
        <span class="plabel" id="sizeLabel2">粗细</span>
        <input type="range" id="sizeRange" min="1" max="40" value="4" />
        <span id="sizeVal" class="pval">4</span>
      </div>
      <div class="prow" id="arrowRow">
        <span class="plabel">箭头</span>
        <select id="arrowHead">
          <option value="filled">实心</option>
          <option value="hollow">空心</option>
        </select>
        <select id="arrowEnds">
          <option value="single">单端</option>
          <option value="double">双端</option>
        </select>
      </div>
      <div class="prow" id="textRow">
        <span class="plabel">文字</span>
        <select id="textWeight" title="粗细">
          <option value="300">细体</option>
          <option value="400">常规</option>
          <option value="600">中粗</option>
          <option value="700">加粗</option>
          <option value="900">特粗</option>
        </select>
        <button id="textItalic" class="tbtn">斜体</button>
      </div>
      <div class="prow" id="mosaicRow">
        <span class="plabel">类型</span>
        <select id="mosaicMode">
          <option value="mosaic">马赛克</option>
          <option value="blur">模糊</option>
        </select>
      </div>
      <div class="prow" id="eyedropperRow" style="display:none">
        <span class="plabel">放大</span>
        <input type="range" id="eyedropperZoom" min="1" max="20" step="0.5" value="4" />
        <span id="eyedropperZoomVal" class="pval">4×</span>
      </div>
      <div class="prow" id="rectRow">
        <span class="plabel">形状</span>
        <button id="rectFill" class="tbtn">填充</button>
      </div>
    </div>
    <div id="hint2">选区内可加 箭头/矩形/椭圆/画笔/文字/马赛克/吸管 · 吸管：移动鼠标看放大预览、滚轮或滑杆调整倍数取更精确颜色，方向键可逐像素微调定位，单击即取色并设为当前颜色（右侧「复制」按钮可将色值写入剪贴板） · 选择工具：拖选区内部可平移、拖边缘 8 手柄可缩放选区，点中标注后可拖动（四角缩放、顶部圆点旋转） · Enter 复制 · Esc 取消 · Delete 删除</div>
    <input id="textInput" type="text" maxlength="200" />
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
// 截图选框层（选区 + 内置标注）：参考 windowMode 内部待办小窗的用法，
// 由主进程以路由 /#/screenshotSelect 形式在独立透明子窗口中加载。
// 逻辑为命令式 DOM/Canvas，整体移植自原 public/screenshot-select.html，
// 仅把入口 IIFE 放入 onMounted，IPC 契约保持不变。
import { onMounted } from "vue";

onMounted(() => {
  var ipc = window.ipcRenderer;
  var FONT = "sans-serif";

  var sel = document.getElementById("sel");
  var sizeLabel = document.getElementById("sizeLabel");
  var bar = document.getElementById("bar");
  var mag = document.getElementById("mag");
  var magCtx = mag.getContext("2d");
  // 吸管：离屏 1x1 画布，用于在任意缩放级别精确取色
  var pickCanvas = document.createElement("canvas");
  pickCanvas.width = 1; pickCanvas.height = 1;
  var pickCtx = pickCanvas.getContext("2d", { willReadFrequently: true });
  var hint = document.getElementById("hint");
  var hint2 = document.getElementById("hint2");
  var anno = document.getElementById("anno");
  var actx = anno.getContext("2d");
  // 选区阶段的整屏冻结背景画布（Snipaste 风格：先冻结整屏，再框选）
  var bg = document.getElementById("bg");
  var bgCtx = bg.getContext("2d");
  var bgImage = null; // 整屏冻结图（Image），供放大镜 / 重选复用
  var fullW = 0, fullH = 0; // 背景显示尺寸（= 选框层窗口 CSS 尺寸）
  var editor = document.getElementById("editor");
  var props = document.getElementById("props");
  var textInput = document.getElementById("textInput");

  // 属性面板元素
  var palette = document.getElementById("palette");
  var customColor = document.getElementById("customColor");
  var sizeRow = document.getElementById("sizeRow");
  var sizeLabel2 = document.getElementById("sizeLabel2");
  var sizeRange = document.getElementById("sizeRange");
  var sizeVal = document.getElementById("sizeVal");
  var arrowRow = document.getElementById("arrowRow");
  var arrowHead = document.getElementById("arrowHead");
  var arrowEnds = document.getElementById("arrowEnds");
  var textRow = document.getElementById("textRow");
  var textWeight = document.getElementById("textWeight");
  var textItalic = document.getElementById("textItalic");
  var fgLabel = document.getElementById("fgLabel");
  var bgColorRow = document.getElementById("bgColorRow");
  var bgPalette = document.getElementById("bgPalette");
  var bgCustomColor = document.getElementById("bgCustomColor");
  var bgNone = document.getElementById("bgNone");
  var mosaicRow = document.getElementById("mosaicRow");
  var mosaicMode = document.getElementById("mosaicMode");
  var rectRow = document.getElementById("rectRow");
  var rectFill = document.getElementById("rectFill");
  var eyedropperRow = document.getElementById("eyedropperRow");
  var eyedropperZoomInput = document.getElementById("eyedropperZoom");
  var eyedropperZoomVal = document.getElementById("eyedropperZoomVal");
  var eyedropperHex = document.getElementById("eyedropperHex");
  var eyedropperCopy = document.getElementById("eyedropperCopy");

  var W = window.innerWidth, H = window.innerHeight;
  var dpr = window.devicePixelRatio || 1;
  // Snipaste 风格：按下与弹起鼠标的距离小于该阈值视为「单击」→ 截取整屏
  var CLICK_THRESHOLD = 5; // CSS 像素

  // ===== 默认样式（按工具分别保存，参考 Snipaste） =====
  var PALETTE = ["#ff4d4f", "#fa8c16", "#fadb14", "#52c41a", "#13c2c2",
                 "#1890ff", "#722ed1", "#ffffff", "#000000", "#8c8c8c"];
  var DEFAULTS = {
    arrow:   { color: "#ff4d4f", lw: 4,  head: "filled", ends: "single" },
    rect:    { color: "#ff4d4f", lw: 3,  fill: false },
    ellipse: { color: "#ff4d4f", lw: 3,  fill: false },
    brush:   { color: "#ff4d4f", lw: 4 },
    text:    { color: "#ff4d4f", bgColor: null, fontSize: 18, weight: 400, italic: false },
    mosaic:  { block: 14, mode: "mosaic" },
  };
  var SIZE_CFG = {
    arrow:   { label: "粗细", min: 1,  max: 40, step: 1 },
    rect:    { label: "粗细", min: 1,  max: 40, step: 1 },
    ellipse: { label: "粗细", min: 1,  max: 40, step: 1 },
    brush:   { label: "粗细", min: 1,  max: 60, step: 1 },
    text:    { label: "字号", min: 10, max: 80, step: 1 },
    mosaic:  { label: "强度", min: 6,  max: 40, step: 1 },
  };
  var style = JSON.parse(JSON.stringify(DEFAULTS)); // 当前默认
  var activeColor = "#ff4d4f";
  // 吸管：当前放大倍数（1~20）与最近一次光标位置（用于滚轮缩放后重绘放大镜）
  var eyedropperZoom = 4;
  var lastEyedropperPos = { x: 0, y: 0 };

  var phase = "select"; // select | annotate
  var selRect = { x: 0, y: 0, w: 0, h: 0 };
  var mode = null; // draw | move | resize
  var dir = "";
  var dragStart = { x: 0, y: 0 };
  var selStart = { x: 0, y: 0 };

  var img = null, natW = 0, natH = 0;
  var annotations = [];
  var editTool = "select";
  var drawing = null;
  var pendingTextPos = { x: 0, y: 0 };
  var selectedIndex = -1;
  var moving = null;
  // 选中标注的二次变换（缩放 / 旋转）状态
  var transformMode = null; // "scale" | "rotate"
  var tr = {}; // 变换过程缓存：cx/cy/startDist/startScale/startAngle

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function normRect(r) {
    return {
      x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h),
      w: Math.abs(r.w), h: Math.abs(r.h),
    };
  }
  function hasSelection() { return selRect.w > 2 && selRect.h > 2; }
  function hexToRgba(hex, a) {
    var h = hex.replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  // ====================== 选区阶段 ======================
  function syncHandles() {
    // 仅在选区阶段、或标注阶段的选择工具下显示 8 个缩放手柄；
    // 其它画笔 / 文字工具下隐藏手柄，避免误触缩放选区
    var show = (phase === "select") || (phase === "annotate" && editTool === "select");
    sel.classList.toggle("handles-on", show);
  }

  function renderSel() {
    if (hasSelection()) {
      sel.classList.add("active");
      sel.style.left = selRect.x + "px";
      sel.style.top = selRect.y + "px";
      sel.style.width = selRect.w + "px";
      sel.style.height = selRect.h + "px";
      sizeLabel.textContent = Math.round(selRect.w) + " × " + Math.round(selRect.h);
      var tw = bar.offsetWidth || 200, th = bar.offsetHeight || 38;
      var tx = clamp(selRect.x + selRect.w - tw, 4, W - tw - 4);
      var ty = selRect.y + selRect.h + 10;
      if (ty + th > H - 4) ty = selRect.y - th - 10;
      ty = clamp(ty, 4, H - th - 4);
      bar.style.left = tx + "px";
      bar.style.top = ty + "px";
      bar.classList.add("active");
    } else {
      // 空选区（区域模式初始）：工具条固定顶部居中，提示先框选
      sel.classList.remove("active");
      sizeLabel.textContent = "";
      bar.style.left = (W / 2 - (bar.offsetWidth || 200) / 2) + "px";
      bar.style.top = "8px";
      bar.classList.add("active");
    }
    syncHandles();
  }

  function showMagnifier(cx, cy) {
    if (!bgImage || !bgImage.complete) return;
    mag.classList.add("active");
    magCtx.clearRect(0, 0, 140, 140);
    var f = fullW > 0 ? bgImage.naturalWidth / fullW : 1; // 图片像素 / CSS 像素
    var zoom = 2.4, m = 56; // 放大镜取样半径（图片像素）
    var sx = cx * f - m, sy = cy * f - m;
    sx = clamp(sx, 0, bgImage.naturalWidth - 2 * m);
    sy = clamp(sy, 0, bgImage.naturalHeight - 2 * m);
    magCtx.imageSmoothingEnabled = false;
    magCtx.drawImage(bgImage, sx, sy, 2 * m, 2 * m, 0, 0, 140, 140);
    magCtx.imageSmoothingEnabled = true;
    magCtx.strokeStyle = "rgba(64,158,255,.9)";
    magCtx.lineWidth = 1;
    magCtx.beginPath();
    magCtx.moveTo(70, 0); magCtx.lineTo(70, 140);
    magCtx.moveTo(0, 70); magCtx.lineTo(140, 70);
    magCtx.stroke();
    var mx = cx + 18, my = cy + 18;
    if (mx + 140 > W) mx = cx - 158;
    if (my + 140 > H) my = cy - 158;
    mag.style.left = mx + "px";
    mag.style.top = my + "px";
  }
  function hideMagnifier() { mag.classList.remove("active"); }

  // ====================== 吸管取色 ======================
  function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(function (v) {
      var s = (v & 0xff).toString(16);
      return s.length === 1 ? "0" + s : s;
    }).join("").toUpperCase();
  }
  // 从整屏冻结图 bgImage 采样某 CSS 坐标处的精确像素颜色
  function sampleColorAt(cx, cy) {
    if (!bgImage || !bgImage.complete) return null;
    var f = fullW > 0 ? bgImage.naturalWidth / fullW : 1; // 图片像素 / CSS 像素
    var ix = clamp(Math.round(cx * f), 0, bgImage.naturalWidth - 1);
    var iy = clamp(Math.round(cy * f), 0, bgImage.naturalHeight - 1);
    pickCtx.clearRect(0, 0, 1, 1);
    pickCtx.drawImage(bgImage, ix, iy, 1, 1, 0, 0, 1, 1);
    var d = pickCtx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3], hex: rgbToHex(d[0], d[1], d[2]) };
  }
  // 取色后写入当前绘制颜色（箭头/矩形/椭圆/画笔/文字默认色），并同步调色板与自定义色
  function pickColorAt(x, y) {
    var col = sampleColorAt(x, y);
    if (!col) return;
    activeColor = col.hex;
    style.arrow.color = col.hex; style.text.color = col.hex;
    style.rect.color = col.hex; style.ellipse.color = col.hex; style.brush.color = col.hex;
    markSwatch(col.hex);
    if (eyedropperHex) eyedropperHex.textContent = col.hex;
  }
  // 吸管放大镜：以可调倍数放大光标周围区域，十字准星中心即取色点，并显示 hex
  function showEyedropperMag(cx, cy) {
    if (!bgImage || !bgImage.complete) return;
    lastEyedropperPos = { x: cx, y: cy };
    mag.classList.add("active");
    magCtx.clearRect(0, 0, 140, 140);
    var f = fullW > 0 ? bgImage.naturalWidth / fullW : 1;
    var span = 140 / eyedropperZoom;        // 取样区域宽度（图片像素）
    var m = span / 2;
    var sx = clamp(cx * f - m, 0, bgImage.naturalWidth - span);
    var sy = clamp(cy * f - m, 0, bgImage.naturalHeight - span);
    magCtx.imageSmoothingEnabled = false;
    magCtx.drawImage(bgImage, sx, sy, span, span, 0, 0, 140, 140);
    magCtx.imageSmoothingEnabled = true;
    // 十字准星
    magCtx.strokeStyle = "rgba(64,158,255,.9)";
    magCtx.lineWidth = 1;
    magCtx.beginPath();
    magCtx.moveTo(70, 0); magCtx.lineTo(70, 140);
    magCtx.moveTo(0, 70); magCtx.lineTo(140, 70);
    magCtx.stroke();
    // 中心像素高亮框（框住准星正中的那一像素，便于精确定位）
    var box = Math.max(2, eyedropperZoom);
    magCtx.strokeStyle = "rgba(255,255,255,.95)";
    magCtx.lineWidth = 2;
    magCtx.strokeRect(70 - box / 2 - 1, 70 - box / 2 - 1, box + 2, box + 2);
    // hex 文本（圆形放大镜：居中于底部圆弧内，避免被圆形边缘裁切）
    var col = sampleColorAt(cx, cy);
    magCtx.font = "bold 13px monospace";
    magCtx.textAlign = "center";
    magCtx.textBaseline = "middle";
    var txt = col ? col.hex : "#000000";
    var tw = magCtx.measureText(txt).width;
    var bw = tw + 14, bh = 20;
    var bx = 70 - bw / 2, by = 122 - bh; // 靠近底部、水平居中，落在圆形区域内
    magCtx.fillStyle = "rgba(0,0,0,.62)";
    magCtx.fillRect(bx, by, bw, bh);
    magCtx.fillStyle = "#fff";
    magCtx.fillText(txt, 70, by + bh / 2 + 1);
    magCtx.textAlign = "left";
    magCtx.textBaseline = "alphabetic";
    // 注意：面板色值文本不在此处实时更新（否则会随鼠标移动变化）；
    // 只有单击确认取色时（pickColorAt）才写，保证与颜色栏一致、复制的是确认色。
    // 跟随光标，避免遮挡
    var mx = cx + 18, my = cy + 18;
    if (mx + 140 > W) mx = cx - 158;
    if (my + 140 > H) my = cy - 158;
    mag.style.left = mx + "px";
    mag.style.top = my + "px";
  }

  function pointInSel(px, py) {
    return hasSelection() &&
      px >= selRect.x && px <= selRect.x + selRect.w &&
      py >= selRect.y && py <= selRect.y + selRect.h;
  }

  var selectBusy = false; // 防止单击/双击/Enter 重复触发选区确认
  function confirmSelect() {
    if (!hasSelection() || selectBusy) return;
    selectBusy = true;
    var rect = normRect(selRect);
    bar.classList.remove("active");
    // 本地进入标注阶段（直接复用整屏冻结图 bgImage），不再请求主进程裁剪，避免异步重载黑屏
    enterAnnotate(rect);
  }

  // ====================== 标注绘制 ======================
  function drawHead(ctx, x, y, ang, head, color, headStyle) {
    var l = head, spread = Math.PI / 7;
    var p1x = x - l * Math.cos(ang - spread), p1y = y - l * Math.sin(ang - spread);
    var p2x = x - l * Math.cos(ang + spread), p2y = y - l * Math.sin(ang + spread);
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(p1x, p1y); ctx.lineTo(p2x, p2y); ctx.closePath();
    if (headStyle === "hollow") {
      ctx.lineWidth = Math.max(1, head / 6);
      ctx.strokeStyle = color; ctx.stroke();
    } else {
      ctx.fillStyle = color; ctx.fill();
    }
  }
  function paintArrow(ctx, a, kd) {
    var lw = a.lw * kd;
    var head = lw * 4;
    var spread = Math.PI / 7;
    var isFilled = a.head !== "hollow";
    // 实心箭头：圆帽补到三角形底边，被填充区域盖住，看不出外溢。
    // 空心箭头：必须用平帽停在三角形底边，否则圆帽会填充空心内部。
    var baseDepth = head * Math.cos(spread);
    var shaftInset = isFilled ? baseDepth - lw / 2 : baseDepth;
    if (shaftInset < 0) shaftInset = 0;

    var ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var len = Math.hypot(a.x2 - a.x1, a.y2 - a.y1) * kd;
    var isDouble = a.ends === "double";
    var totalInset = shaftInset * (isDouble ? 2 : 1);

    ctx.save();
    ctx.lineWidth = lw; ctx.lineCap = isFilled ? "round" : "butt"; ctx.lineJoin = "round";
    ctx.strokeStyle = a.color; ctx.fillStyle = a.color;

    // 仅当长度够两个箭头 + 躯干时才画线；否则只画箭头
    if (len > totalInset + Math.max(1, lw * 0.5)) {
      var sx = a.x1 * kd + (isDouble ? dx * shaftInset : 0);
      var sy = a.y1 * kd + (isDouble ? dy * shaftInset : 0);
      var ex = a.x2 * kd - dx * shaftInset;
      var ey = a.y2 * kd - dy * shaftInset;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    }

    drawHead(ctx, a.x2 * kd, a.y2 * kd, ang, head, a.color, a.head);
    if (isDouble) drawHead(ctx, a.x1 * kd, a.y1 * kd, ang + Math.PI, head, a.color, a.head);
    ctx.restore();
  }
  function textFontStyle(a, fs) {
    var s = "";
    if (a.italic) s += "italic ";
    if (a.weight && a.weight !== 400) s += a.weight + " ";
    return s + fs + "px " + FONT;
  }
  function paintText(ctx, a, kd) {
    ctx.save();
    var fs = a.fontSize * kd;
    ctx.font = textFontStyle(a, fs);
    ctx.textBaseline = "top";
    if (a.bgColor) {
      var w = ctx.measureText(a.text).width;
      var pad = Math.max(2, fs * 0.16);
      ctx.fillStyle = a.bgColor;
      ctx.fillRect(a.x * kd - pad, a.y * kd - pad, w + pad * 2, fs + pad * 2);
    }
    ctx.fillStyle = a.color;
    ctx.fillText(a.text, a.x * kd, a.y * kd);
    ctx.restore();
  }
  function paintMosaic(ctx, a, kd, f, srcImg) {
    var sx = a.x * f, sy = a.y * f, sw = a.w * f, sh = a.h * f;
    if (sw <= 1 || sh <= 1) return;
    var block = a.block * kd;
    var stepsX = Math.max(1, Math.floor(sw / block));
    var stepsY = Math.max(1, Math.floor(sh / block));
    var tmp = document.createElement("canvas");
    tmp.width = stepsX; tmp.height = stepsY;
    var tctx = tmp.getContext("2d");
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(srcImg, sx, sy, sw, sh, 0, 0, stepsX, stepsY);
    ctx.imageSmoothingEnabled = (a.mode === "blur"); // 模糊=平滑放大，马赛克=最近邻
    ctx.drawImage(tmp, 0, 0, stepsX, stepsY, a.x * kd, a.y * kd, a.w * kd, a.h * kd);
    ctx.imageSmoothingEnabled = true;
  }
  function paintRect(ctx, a, kd) {
    ctx.save();
    ctx.lineWidth = a.lw * kd; ctx.lineJoin = "round";
    ctx.strokeStyle = a.color;
    var x = Math.min(a.x1, a.x2) * kd, y = Math.min(a.y1, a.y2) * kd;
    var w = Math.abs(a.x2 - a.x1) * kd, h = Math.abs(a.y2 - a.y1) * kd;
    if (a.fill) { ctx.fillStyle = hexToRgba(a.color, 0.25); ctx.fillRect(x, y, w, h); }
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
  function paintEllipse(ctx, a, kd) {
    ctx.save();
    ctx.lineWidth = a.lw * kd; ctx.lineJoin = "round";
    var x1 = a.x1 * kd, y1 = a.y1 * kd, x2 = a.x2 * kd, y2 = a.y2 * kd;
    var cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    var rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (a.fill) { ctx.fillStyle = hexToRgba(a.color, 0.25); ctx.fill(); }
    ctx.strokeStyle = a.color; ctx.stroke();
    ctx.restore();
  }
  function paintBrush(ctx, a, kd) {
    if (!a.points || a.points.length === 0) return;
    ctx.save();
    ctx.lineWidth = a.lw * kd; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = a.color;
    ctx.beginPath();
    ctx.moveTo(a.points[0].x * kd, a.points[0].y * kd);
    for (var i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x * kd, a.points[i].y * kd);
    ctx.stroke();
    ctx.restore();
  }
  // 应用二次变换（缩放 + 旋转）后绘制标注本身
  function withTransform(ctx, a, kd, fn) {
    var b = bbox(a);
    var s = a.scale || 1, rot = a.rot || 0;
    var cx = (b.x + b.w / 2) * kd, cy = (b.y + b.h / 2) * kd;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    fn();
    ctx.restore();
  }
  function paintAnnotation(ctx, a, kd, f) {
    withTransform(ctx, a, kd, function () {
      if (a.type === "arrow") paintArrow(ctx, a, kd);
      else if (a.type === "rect") paintRect(ctx, a, kd);
      else if (a.type === "ellipse") paintEllipse(ctx, a, kd);
      else if (a.type === "brush") paintBrush(ctx, a, kd);
      else if (a.type === "text") paintText(ctx, a, kd);
      else if (a.type === "mosaic") paintMosaic(ctx, a, kd, f, img);
    });
  }

  function renderAnno() {
    if (phase !== "annotate") return;
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.clearRect(0, 0, W, H);
    // 全屏冻结图（整屏），标注坐标即屏幕坐标，故 kd=1
    if (bgImage && bgImage.complete) {
      actx.imageSmoothingEnabled = true;
      actx.drawImage(bgImage, 0, 0, W, H);
    }
    var f = natW / W; // 整屏原生像素 / 显示像素（马赛克采样用）
    for (var i = 0; i < annotations.length; i++) paintAnnotation(actx, annotations[i], 1, f);
    if (drawing) paintAnnotation(actx, drawing, 1, f);
    if (selectedIndex >= 0 && annotations[selectedIndex]) drawSelection(actx, annotations[selectedIndex]);
  }

  function drawSelection(ctx, a) {
    var g = geom(a);
    ctx.save();
    // 旋转后的虚线轮廓
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(64,158,255,.95)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.corners.nw[0], g.corners.nw[1]);
    ctx.lineTo(g.corners.ne[0], g.corners.ne[1]);
    ctx.lineTo(g.corners.se[0], g.corners.se[1]);
    ctx.lineTo(g.corners.sw[0], g.corners.sw[1]);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    // 四角缩放手柄
    var hs = 7;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "rgba(64,158,255,.95)";
    ctx.lineWidth = 1.5;
    [g.corners.nw, g.corners.ne, g.corners.se, g.corners.sw].forEach(function (p) {
      ctx.beginPath();
      ctx.rect(p[0] - hs / 2, p[1] - hs / 2, hs, hs);
      ctx.fill(); ctx.stroke();
    });
    // 旋转手柄：顶部中线延伸出的圆点
    var cdx = g.topMid[0] - g.cx, cdy = g.topMid[1] - g.cy;
    var len = Math.hypot(cdx, cdy) || 1;
    var rx = g.topMid[0] + cdx / len * 22, ry = g.topMid[1] + cdy / len * 22;
    ctx.beginPath();
    ctx.moveTo(g.topMid[0], g.topMid[1]);
    ctx.lineTo(rx, ry);
    ctx.strokeStyle = "rgba(64,158,255,.95)";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rx, ry, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#409eff"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.restore();
  }

  function composeFinalImage() {
    // 先合成整屏（原生分辨率）最终图，再裁剪到当前选区
    var full = document.createElement("canvas");
    full.width = natW; full.height = natH;
    var fctx = full.getContext("2d");
    fctx.imageSmoothingEnabled = true;
    var f = natW / W;
    fctx.drawImage(bgImage, 0, 0, natW, natH);
    for (var i = 0; i < annotations.length; i++) paintAnnotation(fctx, annotations[i], f, f);
    var sx = Math.max(0, Math.round(selRect.x * f));
    var sy = Math.max(0, Math.round(selRect.y * f));
    var sw = Math.max(1, Math.round(selRect.w * f));
    var sh = Math.max(1, Math.round(selRect.h * f));
    var out = document.createElement("canvas");
    out.width = sw; out.height = sh;
    var octx = out.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  }

  // ===== 标注几何辅助（点选 / 移动 / 包围盒） =====
  var _mctx = document.createElement("canvas").getContext("2d");
  function textWidth(a) {
    _mctx.font = textFontStyle(a, a.fontSize);
    return _mctx.measureText(a.text).width;
  }
  function distToSeg(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    var t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function rectEllipseHit(a, lx, ly) {
    if (a.type === "rect") {
      var x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
      var w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
      return lx >= x - a.lw && lx <= x + w + a.lw && ly >= y - a.lw && ly <= y + h + a.lw;
    }
    // ellipse：按到椭圆环的近似距离判断
    var cx = (a.x1 + a.x2) / 2, cy = (a.y1 + a.y2) / 2;
    var rx = Math.abs(a.x2 - a.x1) / 2, ry = Math.abs(a.y2 - a.y1) / 2;
    if (rx <= 0 || ry <= 0) return false;
    var nx = (lx - cx) / rx, ny = (ly - cy) / ry;
    var d = Math.abs(Math.hypot(nx, ny) - 1) * Math.min(rx, ry);
    return d <= a.lw / 2 + 4;
  }
  function brushHit(a, lx, ly) {
    for (var i = 1; i < a.points.length; i++) {
      if (distToSeg(lx, ly, a.points[i - 1].x, a.points[i - 1].y, a.points[i].x, a.points[i].y)
          <= a.lw / 2 + 4) return true;
    }
    return false;
  }
  function hitTest(px, py) {
    for (var i = annotations.length - 1; i >= 0; i--) {
      var a = annotations[i];
      var lp = toLocal(px, py, a); // 反变换到本地坐标，兼容缩放/旋转
      var lx = lp[0], ly = lp[1];
      if (a.type === "arrow") {
        if (distToSeg(lx, ly, a.x1, a.y1, a.x2, a.y2) <= Math.max(6, a.lw / 2 + 4)) return i;
      } else if (a.type === "text") {
        var w = textWidth(a);
        if (lx >= a.x && lx <= a.x + w && ly >= a.y && ly <= a.y + a.fontSize) return i;
      } else if (a.type === "rect" || a.type === "ellipse") {
        if (rectEllipseHit(a, lx, ly)) return i;
      } else if (a.type === "brush") {
        if (brushHit(a, lx, ly)) return i;
      } else if (a.type === "mosaic") {
        if (lx >= a.x && lx <= a.x + a.w && ly >= a.y && ly <= a.y + a.h) return i;
      }
    }
    return -1;
  }
  function bbox(a) {
    if (a.type === "arrow" || a.type === "rect" || a.type === "ellipse") {
      return { x: Math.min(a.x1, a.x2) - a.lw, y: Math.min(a.y1, a.y2) - a.lw,
               w: Math.abs(a.x2 - a.x1) + 2 * a.lw, h: Math.abs(a.y2 - a.y1) + 2 * a.lw };
    }
    if (a.type === "text") {
      return { x: a.x - 4, y: a.y - 4, w: textWidth(a) + 8, h: a.fontSize + 8 };
    }
    if (a.type === "brush") {
      var xs = a.points.map(function (p) { return p.x; });
      var ys = a.points.map(function (p) { return p.y; });
      var minx = Math.min.apply(null, xs), miny = Math.min.apply(null, ys);
      var maxx = Math.max.apply(null, xs), maxy = Math.max.apply(null, ys);
      return { x: minx - a.lw, y: miny - a.lw, w: (maxx - minx) + 2 * a.lw, h: (maxy - miny) + 2 * a.lw };
    }
    return { x: a.x, y: a.y, w: a.w, h: a.h }; // mosaic
  }
  function moveAnnotation(a, dx, dy) {
    if (a.type === "arrow" || a.type === "rect" || a.type === "ellipse") {
      a.x1 += dx; a.y1 += dy; a.x2 += dx; a.y2 += dy;
    } else if (a.type === "brush") {
      for (var i = 0; i < a.points.length; i++) { a.points[i].x += dx; a.points[i].y += dy; }
    } else {
      a.x += dx; a.y += dy;
    }
  }
  // ===== 二次变换（缩放 / 旋转）几何模型 =====
  // 以标注本地包围盒中心为锚点，应用 缩放(s) + 旋转(rot) 得到屏幕坐标。
  function geom(a) {
    var b = bbox(a);
    var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    var s = a.scale || 1, rot = a.rot || 0;
    var cos = Math.cos(rot), sin = Math.sin(rot);
    function tf(dx, dy) {
      var sx = dx * s, sy = dy * s;
      return [cx + sx * cos - sy * sin, cy + sx * sin + sy * cos];
    }
    return {
      cx: cx, cy: cy, s: s, rot: rot,
      corners: {
        nw: tf(-b.w / 2, -b.h / 2), ne: tf(b.w / 2, -b.h / 2),
        sw: tf(-b.w / 2, b.h / 2),  se: tf(b.w / 2, b.h / 2),
      },
      // 旋转手柄锚点：本地顶部中点（旋转后的顶部中心）
      topMid: tf(0, -b.h / 2),
    };
  }
  // 屏幕坐标 → 标注本地坐标（逆变换，用于命中测试）
  function toLocal(px, py, a) {
    var g = geom(a);
    var u = px - g.cx, v = py - g.cy;
    var sx = u * Math.cos(g.rot) + v * Math.sin(g.rot);
    var sy = -u * Math.sin(g.rot) + v * Math.cos(g.rot);
    return [g.cx + sx / g.s, g.cy + sy / g.s];
  }
  function selBox(a) {
    var g = geom(a);
    var xs = [g.corners.nw[0], g.corners.ne[0], g.corners.sw[0], g.corners.se[0]];
    var ys = [g.corners.nw[1], g.corners.ne[1], g.corners.sw[1], g.corners.se[1]];
    var x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
    return { x: x, y: y, w: Math.max.apply(null, xs) - x, h: Math.max.apply(null, ys) - y };
  }
  function handleAt(px, py, a) {
    var g = geom(a);
    var cdx = g.topMid[0] - g.cx, cdy = g.topMid[1] - g.cy;
    var len = Math.hypot(cdx, cdy) || 1;
    var rx = g.topMid[0] + cdx / len * 22, ry = g.topMid[1] + cdy / len * 22;
    if (Math.hypot(px - rx, py - ry) <= 9) return "rotate";
    var corners = [g.corners.nw, g.corners.ne, g.corners.se, g.corners.sw];
    for (var k = 0; k < corners.length; k++)
      if (Math.hypot(px - corners[k][0], py - corners[k][1]) <= 9) return "scale";
    return null;
  }

  // ===== 新建标注（使用当前默认样式） =====
  function newArrow(x, y) {
    var s = style.arrow;
    return { type: "arrow", x1: x, y1: y, x2: x, y2: y,
             color: s.color, lw: s.lw, head: s.head, ends: s.ends };
  }
  function newRect(x, y) {
    var s = style.rect;
    return { type: "rect", x1: x, y1: y, x2: x, y2: y,
             color: s.color, lw: s.lw, fill: s.fill };
  }
  function newEllipse(x, y) {
    var s = style.ellipse;
    return { type: "ellipse", x1: x, y1: y, x2: x, y2: y,
             color: s.color, lw: s.lw, fill: s.fill };
  }
  function newBrush(x, y) {
    var s = style.brush;
    return { type: "brush", color: s.color, lw: s.lw, points: [{ x: x, y: y }] };
  }
  function newMosaic(x, y, w, h) {
    var s = style.mosaic;
    return { type: "mosaic", x: x, y: y, w: w, h: h, block: s.block, mode: s.mode };
  }

  function commitDrawing() {
    if (!drawing) return;
    var d = drawing; drawing = null;
    var pushed = false;
    if (d.type === "arrow") {
      if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 3) { annotations.push(d); pushed = true; }
    } else if (d.type === "rect" || d.type === "ellipse") {
      if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 3) { annotations.push(d); pushed = true; }
    } else if (d.type === "brush") {
      if (d.points.length > 1) { annotations.push(d); pushed = true; }
    } else {
      var rr = normRect(d);
      if (rr.w > 3 && rr.h > 3) {
        annotations.push({ type: "mosaic", x: rr.x, y: rr.y, w: rr.w, h: rr.h, block: d.block, mode: d.mode });
        pushed = true;
      }
    }
    // 保持当前工具便于连续绘制，同时选中刚画的标注，
    // 这样属性面板可继续编辑其颜色 / 形态 / 大小
    selectedIndex = pushed ? annotations.length - 1 : -1;
    updateToolButtons(); syncPanel(); renderAnno();
    console.log(annotations, 'annotations in openTextInput')
  }

  function openTextInput(cx, cy, x, y) {
    pendingTextPos = { x: x, y: y };
    textInput.style.display = "block";
    textInput.style.left = cx + "px";
    textInput.style.top = cy + "px";
    textInput.value = "";
    // 关键：用 rAF 在浏览器默认焦点行为之后再次聚焦，避免被 mousedown 抢回 body
    textInput.focus();
    requestAnimationFrame(function () { textInput.focus(); });
  }
  function commitText() {
    if (textInput.style.display !== "block") return;
    var t = textInput.value.trim();
    textInput.style.display = "none";
    if (t) {
      var s = style.text;
      annotations.push({ type: "text", x: pendingTextPos.x, y: pendingTextPos.y,
                         text: t, color: s.color, bgColor: s.bgColor,
                         fontSize: s.fontSize, weight: s.weight, italic: s.italic });
      // 选中刚输入的文字，便于用属性面板继续调整前景色 / 背景色 / 字号 / 粗细 / 斜体
      selectedIndex = annotations.length - 1;
    } else {
      selectedIndex = -1;
    }
    updateToolButtons(); syncPanel(); renderAnno();
  }

  // ====================== 工具栏 / 属性面板 ======================
  function setTool(t) {
    editTool = t;
    if (t !== "eyedropper") hideMagnifier();
    if (t !== "select") {
      selectedIndex = -1;
      // 非选择工具：仅隐藏缩放手柄（避免误触缩放选区），保留暗化遮罩，便于在画布上绘制
    } else if (phase === "annotate" && hasSelection()) {
      showRegionHandles(); // 切回选择工具：重新显示选区边框 + 缩放手柄
    }
    anno.style.cursor = (t === "select") ? "default" : "crosshair";
    syncHandles();
    updateToolButtons();
    syncPanel();
  }
  function updateToolButtons() {
    var hl = selectedIndex >= 0 ? annotations[selectedIndex].type : editTool;
    var btns = editor.querySelectorAll("[data-tool]");
    for (var i = 0; i < btns.length; i++)
      btns[i].classList.toggle("active", btns[i].getAttribute("data-tool") === hl);
  }
  function markSwatch(c) {
    var sw = palette.querySelectorAll(".swatch");
    for (var i = 0; i < sw.length; i++)
      sw[i].classList.toggle("active", sw[i].getAttribute("data-color") === c);
    customColor.value = c;
  }
  function markBgSwatch(c) {
    var sw = bgPalette.querySelectorAll(".swatch");
    for (var i = 0; i < sw.length; i++)
      sw[i].classList.toggle("active", sw[i].getAttribute("data-color") === c);
    bgCustomColor.value = c || "#ffffff";
  }
  function syncPanel() {
    var src = null, tool = null;
    if (selectedIndex >= 0) { src = annotations[selectedIndex]; tool = src.type; }
    else if (editTool !== "select") { src = style[editTool]; tool = editTool; }
    // 颜色（文字时为前景色）
    var c = src ? (src.type === "mosaic" ? activeColor : src.color) : activeColor;
    markSwatch(c);
    fgLabel.textContent = tool === "text" ? "前景" : "颜色";
    // 文字背景色行（仅文字工具显示）
    bgColorRow.style.display = tool === "text" ? "flex" : "none";
    if (tool === "text") markBgSwatch(src.bgColor || "#ffffff");
    // 尺寸行（粗细/字号/强度）
    if (tool && SIZE_CFG[tool]) {
      sizeRow.style.display = "flex";
      var cfg = SIZE_CFG[tool];
      sizeLabel2.textContent = cfg.label;
      sizeRange.min = cfg.min; sizeRange.max = cfg.max; sizeRange.step = cfg.step;
      var v = (tool === "arrow" || tool === "rect" || tool === "ellipse" || tool === "brush")
        ? src.lw : tool === "text" ? src.fontSize : src.block;
      sizeRange.value = v; sizeVal.textContent = v;
    } else sizeRow.style.display = "none";
    // 工具专属行
    arrowRow.style.display = tool === "arrow" ? "flex" : "none";
    textRow.style.display = tool === "text" ? "flex" : "none";
    mosaicRow.style.display = tool === "mosaic" ? "flex" : "none";
    eyedropperRow.style.display = tool === "eyedropper" ? "flex" : "none";
    // 色值文本 + 复制按钮跟随吸管工具，显示在颜色栏后
    var isE = tool === "eyedropper";
    if (eyedropperHex) eyedropperHex.style.display = isE ? "inline-block" : "none";
    if (eyedropperCopy) eyedropperCopy.style.display = isE ? "inline-block" : "none";
    rectRow.style.display = (tool === "rect" || tool === "ellipse") ? "flex" : "none";
    if (tool === "arrow") { arrowHead.value = src.head; arrowEnds.value = src.ends; }
    if (tool === "text") { textWeight.value = String(src.weight || 400); textItalic.classList.toggle("active", !!src.italic); }
    if (tool === "mosaic") { mosaicMode.value = src.mode; }
    if (tool === "rect" || tool === "ellipse") { rectFill.classList.toggle("active", !!src.fill); }
  }
  // 属性写入：若已选中元素则改该元素，同时更新对应默认
  function setColor(c) {
    activeColor = c;
    if (selectedIndex >= 0) {
      var a = annotations[selectedIndex];
      if (a.type !== "mosaic") a.color = c;
      renderAnno();
    }
    style.arrow.color = c; style.text.color = c;
    style.rect.color = c; style.ellipse.color = c; style.brush.color = c;
    markSwatch(c);
  }
  function setBgColor(c) {
    if (selectedIndex >= 0) {
      var a = annotations[selectedIndex];
      if (a.type === "text") { a.bgColor = c; renderAnno(); }
    }
    style.text.bgColor = c;
    markBgSwatch(c);
  }
  function setSize(v) {
    if (selectedIndex >= 0) {
      var a = annotations[selectedIndex];
      if (a.type === "mosaic") a.block = v;
      else if (a.type === "text") a.fontSize = v;
      else a.lw = v;
      renderAnno();
    }
    if (editTool === "arrow" || editTool === "rect" || editTool === "ellipse" || editTool === "brush")
      style[editTool].lw = v;
    else if (editTool === "text") style.text.fontSize = v;
    else if (editTool === "mosaic") style.mosaic.block = v;
    sizeVal.textContent = v;
  }
  function toggleFill() {
    var cur = selectedIndex >= 0 && annotations[selectedIndex].fill !== undefined
      ? annotations[selectedIndex].fill : (style.rect.fill || style.ellipse.fill);
    var nb = !cur;
    if (selectedIndex >= 0 && annotations[selectedIndex].fill !== undefined) {
      annotations[selectedIndex].fill = nb; renderAnno();
    }
    style.rect.fill = nb; style.ellipse.fill = nb;
    rectFill.classList.toggle("active", nb);
  }
  function setProp(key, val) {
    if (selectedIndex >= 0) { annotations[selectedIndex][key] = val; renderAnno(); }
    if (editTool === "arrow") style.arrow[key] = val;
    else if (editTool === "mosaic") style.mosaic[key] = val;
  }
  function setTextWeight(v) {
    v = parseInt(v, 10) || 400;
    if (selectedIndex >= 0) {
      var a = annotations[selectedIndex];
      if (a.type === "text") { a.weight = v; renderAnno(); }
    }
    style.text.weight = v;
  }
  function toggleItalic() {
    var ni = !(selectedIndex >= 0 && annotations[selectedIndex].type === "text"
      ? annotations[selectedIndex].italic : style.text.italic);
    if (selectedIndex >= 0) {
      var a = annotations[selectedIndex];
      if (a.type === "text") { a.italic = ni; renderAnno(); }
    }
    style.text.italic = ni;
    textItalic.classList.toggle("active", ni);
  }

  function showEditor(rect) {
    editor.classList.add("active");
    var tw = editor.offsetWidth || 420, th = editor.offsetHeight || 42;
    editor.style.left = clamp(rect.x + rect.w / 2 - tw / 2, 4, W - tw - 4) + "px";
    editor.style.top = "8px";
  }
  function showProps() { props.classList.add("active"); }

  function drawBg() {
    if (!bgImage) return;
    bg.width = Math.round(fullW * dpr);
    bg.height = Math.round(fullH * dpr);
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bgCtx.clearRect(0, 0, fullW, fullH);
    bgCtx.imageSmoothingEnabled = true;
    bgCtx.drawImage(bgImage, 0, 0, fullW, fullH);
  }

  // 标注阶段「选择」工具：显示选区边框 + 8 缩放手柄（#sel 遮罩覆盖在选区上，仅做视觉窗口）
  function showRegionHandles() {
    sel.style.left = selRect.x + "px";
    sel.style.top = selRect.y + "px";
    sel.style.width = selRect.w + "px";
    sel.style.height = selRect.h + "px";
    sizeLabel.textContent = Math.round(selRect.w) + " × " + Math.round(selRect.h);
    sel.classList.add("active");
    syncHandles();
  }

  // 整屏冻结：进入选区阶段（region 空选区 / full 整屏预选）
  function setupFullBg(data) {
    phase = "select";
    selectBusy = false;
    fullW = W; fullH = H;
    natW = data.width; natH = data.height; // 供放大镜采样
    bgImage = new Image();
    bgImage.onload = function () { drawBg(); };
    bgImage.src = data.dataUrl;
    bg.style.display = "block";
    anno.style.display = "none";
    editor.classList.remove("active");
    props.classList.remove("active");
    hint2.style.display = "none";
    selRect = data.rect && data.rect.w > 0 ? data.rect : { x: 0, y: 0, w: 0, h: 0 };
    hint.textContent = selRect.w > 0
      ? "已预选全屏 · Enter 确认 · 可拖拽调整 · Esc 取消"
      : "拖拽框选区域；单击空白处截取全屏 · Enter 完成 · Esc 取消";
    hint.style.display = "block";
    renderSel();
  }

  // 标注阶段「重选」：回到选区阶段，复用整屏冻结图重新框选
  function resetSelection() {
    phase = "select";
    selectBusy = false;
    annotations = []; selectedIndex = -1; drawing = null; moving = null; transformMode = null;
    anno.style.display = "none";
    editor.classList.remove("active");
    props.classList.remove("active");
    hint2.style.display = "none";
    bg.style.display = "block";
    selRect = { x: 0, y: 0, w: 0, h: 0 };
    hint.textContent = "拖拽框选区域 · Enter 完成 · Esc 取消";
    hint.style.display = "block";
    renderSel();
  }

  function enterAnnotate(rect) {
    phase = "annotate";
    selectBusy = false; // 进入标注即代表一次裁剪已完成，解除确认锁，允许后续拖拽选区再次裁剪
    bg.style.display = "none";
    sel.classList.remove("active");
    bar.classList.remove("active");
    mag.classList.remove("active");
    hint.style.display = "none";
    // 全屏标注画布（屏幕坐标），不依赖主进程回传的裁剪图，避免异步重载导致的黑屏 / 闪频
    anno.style.left = "0px"; anno.style.top = "0px";
    anno.style.width = W + "px"; anno.style.height = H + "px";
    anno.width = Math.round(W * dpr); anno.height = Math.round(H * dpr);
    anno.style.display = "block";
    img = bgImage; // 马赛克源：整屏冻结图（屏幕坐标）
    selRect = normRect(rect);
    annotations = []; selectedIndex = -1; editTool = "select"; drawing = null; moving = null; transformMode = null;
    renderAnno();
    hint2.style.display = "block";
    showEditor(selRect);
    showProps();
    showRegionHandles(); // 选择工具：显示选区边框 + 缩放手柄，可拖拽平移 / 缩放选区
    updateToolButtons();
    syncPanel();
  }

  function doCopy() {
    if (!img) return;
    ipc.send("screenshot:capture-region", { dataUrl: composeFinalImage(), action: "copy" });
  }
  function doSave() {
    if (!img) return;
    ipc.send("screenshot:capture-region", { dataUrl: composeFinalImage(), action: "save" });
  }

  // ====================== 事件 ======================
  window.addEventListener("mousedown", function (e) {
    if (phase === "annotate") {
      // 标注阶段：仅「选择」工具允许拖拽 / 缩放选区本身（与选区阶段操作一致）；其余工具交给 anno 画布
      if (editTool !== "select") return;
    } else {
      if (e.target.closest && e.target.closest("#bar")) return;
    }
    var px = e.clientX, py = e.clientY;
    if (e.target.classList && e.target.classList.contains("handle")) {
      mode = "resize"; dir = e.target.getAttribute("data-dir");
      dragStart = { x: px, y: py };
      selStart = { x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h };
      e.preventDefault(); return;
    }
    if (pointInSel(px, py)) {
      mode = "move"; dragStart = { x: px, y: py };
      selStart = { x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h };
      e.preventDefault(); return;
    }
    // 仅选区阶段：空白处按下开始框选新区域
    if (phase === "select") {
      mode = "draw"; selRect = { x: px, y: py, w: 0, h: 0 };
      dragStart = { x: px, y: py }; renderSel();
    }
  });

  window.addEventListener("mousemove", function (e) {
    if (phase === "annotate" && editTool !== "select") return; // 非选择工具：交给 anno 画布处理标注
    var px = e.clientX, py = e.clientY;
    if (!mode) { if (phase === "select") showMagnifier(px, py); return; }
    if (mode === "draw") {
      if (phase !== "annotate") {
        selRect = { x: dragStart.x, y: dragStart.y, w: px - dragStart.x, h: py - dragStart.y };
      }
    } else if (mode === "move") {
      selRect.x = clamp(selStart.x + (px - dragStart.x), 0, W - selRect.w);
      selRect.y = clamp(selStart.y + (py - dragStart.y), 0, H - selRect.h);
    } else if (mode === "resize") {
      var s = normRect(selStart);
      var left = s.x, top = s.y, right = s.x + s.w, bottom = s.y + s.h;
      if (dir.indexOf("w") >= 0) left = clamp(px, 0, right - 4);
      if (dir.indexOf("e") >= 0) right = clamp(px, left + 4, W);
      if (dir.indexOf("n") >= 0) top = clamp(py, 0, bottom - 4);
      if (dir.indexOf("s") >= 0) bottom = clamp(py, top + 4, H);
      selRect = { x: left, y: top, w: right - left, h: bottom - top };
    }
    if (phase === "annotate") {
      // 选择工具拖拽 / 缩放选区：仅移动遮罩窗口（#sel），标注画布不重绘 → 无闪频、旧标注保留
      showRegionHandles();
    } else {
      renderSel();
      showMagnifier(px, py);
    }
  });

  window.addEventListener("mouseup", function (e) {
    if (phase === "annotate") {
      // 选择工具下结束「拖拽 / 缩放选区」：仅是范围改变，保留旧标注、不重新裁剪、不闪频
      if (editTool === "select" && (mode === "move" || mode === "resize")) {
        mode = null;
        return;
      }
      if (transformMode) { transformMode = null; return; }
      if (moving) { moving = null; return; }
      if (drawing) commitDrawing();
      return;
    }
    if (!mode) return;
    if (mode === "draw") {
      // Snipaste 风格：按下与弹起距离很近 → 视为单击 → 截取整屏
      var dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
      if (Math.abs(dx) <= CLICK_THRESHOLD && Math.abs(dy) <= CLICK_THRESHOLD) {
        selRect = { x: 0, y: 0, w: W, h: H };
        renderSel();
        confirmSelect();
        return;
      }
      selRect = normRect(selRect);
    }
    mode = null; renderSel();
  });

  // 标注画布交互
  anno.addEventListener("mousedown", function (e) {
    if (phase !== "annotate") return;
    var x = e.offsetX, y = e.offsetY;
    if (editTool === "select") {
      // 先判断是否点中已选中标注的 缩放/旋转 手柄
      if (selectedIndex >= 0 && annotations[selectedIndex]) {
        var h = handleAt(x, y, annotations[selectedIndex]);
        if (h === "rotate") {
          var gr = geom(annotations[selectedIndex]);
          transformMode = "rotate";
          tr.startAngle = Math.atan2(y - gr.cy, x - gr.cx) - annotations[selectedIndex].rot;
          e.stopPropagation(); // 阻止 window 把这次当成选区平移
          renderAnno();
          return;
        }
        if (h === "scale") {
          var gs = geom(annotations[selectedIndex]);
          transformMode = "scale";
          tr.cx = gs.cx; tr.cy = gs.cy;
          tr.startDist = Math.hypot(x - gs.cx, y - gs.cy);
          tr.startScale = annotations[selectedIndex].scale || 1;
          e.stopPropagation(); // 阻止 window 把这次当成选区平移
          renderAnno();
          return;
        }
      }
      var idx = hitTest(x, y);
      if (idx >= 0) {
        // 命中已有标注 → 选中并拖动（阻止冒泡，避免被当成选区平移）
        selectedIndex = idx;
        moving = { lastX: x, lastY: y };
        e.stopPropagation();
        updateToolButtons(); syncPanel(); renderAnno();
        return;
      }
      // 空白处：不在此处理，交给 window 的 mousedown 把这次当作「拖拽 / 缩放选区本身」
      return;
    }
    if (editTool === "text") {
      // 若已有输入框打开，先提交上一段文字（避免丢失），再在点击处打开新的
      if (textInput.style.display === "block") commitText();
      openTextInput(e.clientX, e.clientY, x, y);
      e.preventDefault();
      return;
    }
    if (editTool === "eyedropper") {
      e.preventDefault();
      pickColorAt(lastEyedropperPos.x, lastEyedropperPos.y);
      showEyedropperMag(lastEyedropperPos.x, lastEyedropperPos.y);
      return;
    }
    e.preventDefault();
    dragStart = { x: x, y: y };
    drawing = editTool === "arrow" ? newArrow(x, y)
            : editTool === "rect" ? newRect(x, y)
            : editTool === "ellipse" ? newEllipse(x, y)
            : editTool === "brush" ? newBrush(x, y)
            : newMosaic(x, y, 0, 0);
  });
  // 标注阶段拖动交互（窗口级，支持拖出画布范围）：缩放 / 旋转 / 移动 / 绘制
  window.addEventListener("mousemove", function (e) {
    if (phase !== "annotate") return;
    var r = anno.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    if (editTool === "eyedropper") { showEyedropperMag(x, y); return; }
    if (transformMode) {
      var a = annotations[selectedIndex];
      if (!a) { transformMode = null; return; }
      if (transformMode === "rotate") {
        var g = geom(a);
        a.rot = Math.atan2(y - g.cy, x - g.cx) - tr.startAngle;
      } else if (transformMode === "scale") {
        var d = Math.hypot(x - tr.cx, y - tr.cy);
        a.scale = clamp(tr.startScale * d / (tr.startDist || 1), 0.1, 8);
      }
      renderAnno();
      return;
    }
    if (moving) {
      moveAnnotation(annotations[selectedIndex], x - moving.lastX, y - moving.lastY);
      moving.lastX = x; moving.lastY = y;
      renderAnno();
      return;
    }
    if (!drawing) return;
    if (drawing.type === "arrow") { drawing.x2 = x; drawing.y2 = y; }
    else if (drawing.type === "mosaic") { drawing.w = x - dragStart.x; drawing.h = y - dragStart.y; }
    else if (drawing.type === "rect" || drawing.type === "ellipse") { drawing.x2 = x; drawing.y2 = y; }
    else if (drawing.type === "brush") { drawing.points.push({ x: x, y: y }); }
    renderAnno();
  });

  window.addEventListener("dblclick", function (e) {
    if (phase !== "select") return;
    if (pointInSel(e.clientX, e.clientY) && hasSelection()) confirmSelect();
  });

  bar.addEventListener("click", function (e) {
    var act = e.target.getAttribute && e.target.getAttribute("data-act");
    if (!act) return;
    if (act === "confirm") confirmSelect();
    else if (act === "full") {
      selRect = { x: 0, y: 0, w: W, h: H };
      renderSel();
      confirmSelect();
    }
    else if (act === "cancel") ipc.send("screenshot:select-cancel");
  });

  editor.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button");
    if (!btn) return;
    if (btn.id === "undoBtn") { annotations.pop(); selectedIndex = -1; renderAnno(); return; }
    var tool = btn.getAttribute("data-tool");
    if (tool) { setTool(tool); return; }
    var act = btn.getAttribute("data-act");
    if (act === "copy") doCopy();
    else if (act === "save") doSave();
    else if (act === "reset") { selectedIndex = -1; resetSelection(); }
    else if (act === "cancel") { selectedIndex = -1; ipc.send("screenshot:select-cancel"); }
  });

  // 属性面板事件
  PALETTE.forEach(function (c) {
    var s = document.createElement("span");
    s.className = "swatch"; s.style.background = c; s.setAttribute("data-color", c);
    s.addEventListener("click", function () { setColor(c); });
    palette.appendChild(s);
  });
  customColor.addEventListener("input", function () { setColor(customColor.value); });
  PALETTE.forEach(function (c) {
    var s = document.createElement("span");
    s.className = "swatch"; s.style.background = c; s.setAttribute("data-color", c);
    s.addEventListener("click", function () { setBgColor(c); });
    bgPalette.appendChild(s);
  });
  bgCustomColor.addEventListener("input", function () { setBgColor(bgCustomColor.value); });
  bgNone.addEventListener("click", function () { setBgColor(null); markBgSwatch("#ffffff"); });
  sizeRange.addEventListener("input", function () { setSize(parseInt(sizeRange.value, 10)); });
  arrowHead.addEventListener("change", function () { setProp("head", arrowHead.value); });
  arrowEnds.addEventListener("change", function () { setProp("ends", arrowEnds.value); });
  mosaicMode.addEventListener("change", function () { setProp("mode", mosaicMode.value); });
  textWeight.addEventListener("change", function () { setTextWeight(textWeight.value); });
  textItalic.addEventListener("click", toggleItalic);
  rectFill.addEventListener("click", toggleFill);
  // 吸管：放大倍数滑杆
  if (eyedropperZoomInput) {
    eyedropperZoomInput.addEventListener("input", function () {
      eyedropperZoom = parseFloat(eyedropperZoomInput.value) || 4;
      if (eyedropperZoomVal) eyedropperZoomVal.textContent = eyedropperZoom.toFixed(1) + "×";
      showEyedropperMag(lastEyedropperPos.x, lastEyedropperPos.y);
    });
  }
  // 吸管：鼠标滚轮调整放大倍数（更顺手）
  anno.addEventListener("wheel", function (e) {
    if (phase !== "annotate" || editTool !== "eyedropper") return;
    e.preventDefault();
    eyedropperZoom = clamp(eyedropperZoom + (e.deltaY < 0 ? 0.6 : -0.6), 1, 20);
    eyedropperZoomInput.value = String(eyedropperZoom);
    if (eyedropperZoomVal) eyedropperZoomVal.textContent = eyedropperZoom.toFixed(1) + "×";
    showEyedropperMag(lastEyedropperPos.x, lastEyedropperPos.y);
  }, { passive: false });
  // 吸管：复制当前预览色到剪贴板
  if (eyedropperCopy) {
    eyedropperCopy.addEventListener("click", function () {
      var hex = eyedropperHex ? eyedropperHex.textContent : "";
      if (!hex || hex.length < 7) return;
      ipc.invoke("screenshot:copy-text", hex)
        .then(function (res: any) {
          if (!res || !res.success) return;
          var prev = eyedropperCopy.textContent;
          eyedropperCopy.textContent = "已复制";
          eyedropperCopy.classList.add("copied");
          setTimeout(function () {
            eyedropperCopy.textContent = prev;
            eyedropperCopy.classList.remove("copied");
          }, 1000);
        })
        .catch(function () { /* noop */ });
    });
  }

  textInput.addEventListener("keydown", function (e) {
    e.stopPropagation();
    if (e.key === "Enter") {
      // 输入法组合中（中文候选词上屏）不要误提交
      if (e.isComposing || e.keyCode === 229) return;
      commitText();
    } else if (e.key === "Escape") { textInput.value = ""; textInput.style.display = "none"; }
  });
  textInput.addEventListener("blur", commitText);

  window.addEventListener("keydown", function (e) {
    if (phase === "select") {
      if (e.key === "Escape") ipc.send("screenshot:select-cancel");
      else if (e.key === "Enter") { if (hasSelection()) confirmSelect(); }
      return;
    }
    if (phase === "annotate") {
      if (textInput.style.display === "block") return; // 文字输入中由输入框处理
      if (e.key === "Escape") { selectedIndex = -1; ipc.send("screenshot:select-cancel"); }
      else if (e.key === "Enter") doCopy();
      else if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        annotations.pop(); selectedIndex = -1; renderAnno();
      }       else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIndex >= 0) { annotations.splice(selectedIndex, 1); selectedIndex = -1; renderAnno(); }
      }
      else if (editTool === "eyedropper" &&
        (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        // 方向键以「1 图像像素」为最精细步进，解决鼠标移动过快、难以精准取色的问题
        var ef = fullW > 0 && bgImage && bgImage.complete ? bgImage.naturalWidth / fullW : 1;
        var step = 1 / ef; // 1 图像像素对应的 CSS 像素
        if (e.key === "ArrowLeft") lastEyedropperPos.x -= step;
        else if (e.key === "ArrowRight") lastEyedropperPos.x += step;
        else if (e.key === "ArrowUp") lastEyedropperPos.y -= step;
        else if (e.key === "ArrowDown") lastEyedropperPos.y += step;
        lastEyedropperPos.x = clamp(lastEyedropperPos.x, 0, W);
        lastEyedropperPos.y = clamp(lastEyedropperPos.y, 0, H);
        showEyedropperMag(lastEyedropperPos.x, lastEyedropperPos.y);
        e.preventDefault();
      }
    }
  });

  // 主进程回传
  ipc.on("screenshot:captured", function (_evt, data) {
    if (data.kind === "crop") { enterAnnotate(data.rect); return; }
    // kind === "full"：整屏冻结图，进入选区阶段
    setupFullBg(data);
  });
  ipc.on("screenshot:select-error", function (_evt, msg) {
    alert("截图失败：" + (msg || "未知错误"));
    ipc.send("screenshot:select-cancel");
  });

  // 通知主进程：选框层已就绪（全屏模式据此触发首次捕获）
  ipc.send("screenshot:select-ready");

  hint.style.display = "block";
  renderSel();
});
</script>

<style scoped>
* { margin: 0; padding: 0; box-sizing: border-box; }
.ss-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: transparent;
  font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  cursor: crosshair;
}
/* ===== 选区阶段：整屏冻结背景 ===== */
#bg {
  position: fixed; left: 0; top: 0; z-index: 5;
  width: 100vw; height: 100vh; display: none;
  image-rendering: auto; pointer-events: none;
}
/* ===== 选区阶段：透明选框 ===== */
#sel {
  position: fixed; display: none; z-index: 10;
  border: 1px solid #409eff;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
#sel.active { display: block; }
#sel .grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px);
  background-size: 33.33% 33.33%;
  pointer-events: none;
}
.handle {
  position: absolute; width: 10px; height: 10px; background: #fff;
  border: 1px solid #409eff; border-radius: 2px; pointer-events: auto;
  display: none;
}
#sel.handles-on .handle { display: block; }
.handle.nw { left: -5px; top: -5px; cursor: nwse-resize; }
.handle.n  { left: 50%; top: -5px; margin-left: -5px; cursor: ns-resize; }
.handle.ne { right: -5px; top: -5px; cursor: nesw-resize; }
.handle.e  { right: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
.handle.se { right: -5px; bottom: -5px; cursor: nwse-resize; }
.handle.s  { left: 50%; bottom: -5px; margin-left: -5px; cursor: ns-resize; }
.handle.sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
.handle.w  { left: -5px; top: 50%; margin-top: -5px; cursor: ew-resize; }
#sizeLabel {
  user-select: none;
  position: absolute; left: 0; top: -24px; white-space: nowrap;
  font-size: 12px; line-height: 18px; padding: 1px 7px; color: #fff;
  background: #409eff; border-radius: 4px; pointer-events: none;
}

/* 选区阶段工具条（确认 / 取消） */
#bar {
  position: fixed; display: none; z-index: 20;
  background: rgba(40, 44, 52, 0.96); border-radius: 8px;
  padding: 6px; gap: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.35);
  font-size: 13px; align-items: center;
}
#bar.active { display: flex; }
#bar button {
  border: none; background: transparent; color: #e6e6e6; cursor: pointer;
  padding: 6px 12px; border-radius: 5px; font-size: 13px; white-space: nowrap;
}
#bar button:hover { background: rgba(255,255,255,.12); color: #fff; }
#bar button.primary { background: #409eff; color: #fff; }
#bar button.primary:hover { background: #66b1ff; }

#mag {
  position: fixed; width: 140px; height: 140px; border-radius: 50%;
  border: 2px solid #fff; box-shadow: 0 4px 14px rgba(0,0,0,.4);
  display: none; pointer-events: none; z-index: 30; background: #000;
}
#mag.active { display: block; }

#hint {
  position: fixed; left: 50%; top: 18px; transform: translateX(-50%);
  background: rgba(40, 44, 52, 0.9); color: #fff; font-size: 12px;
  padding: 6px 14px; border-radius: 16px; pointer-events: none; z-index: 25;
}

/* ===== 标注阶段：全屏标注画布（选区由 #sel 遮罩表示，内容始终整屏、不随选区清空） ===== */
#anno {
  position: fixed; left: 0; top: 0; z-index: 6;
  display: none; pointer-events: auto;
  image-rendering: auto;
}

/* 顶部工具栏（工具 + 操作） */
#editor {
  position: fixed; display: none; z-index: 40;
  top: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(40, 44, 52, 0.96); border-radius: 8px;
  padding: 6px; gap: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.35);
  font-size: 13px; align-items: center;
}
#editor.active { display: flex; }
#editor button {
  border: none; background: transparent; color: #e6e6e6; cursor: pointer;
  padding: 6px 11px; border-radius: 5px; font-size: 13px; white-space: nowrap;
}
#editor button:hover { background: rgba(255,255,255,.12); color: #fff; }
#editor .tool-btn.active { background: #409eff; color: #fff; }
#editor .act.primary { background: #409eff; color: #fff; }
#editor .act.primary:hover { background: #66b1ff; }
#editor .divider { width: 1px; height: 20px; background: rgba(255,255,255,.18); margin: 0 2px; }

/* 属性面板（参考 Snipaste：颜色 / 粗细 / 箭头类型 / 文字样式 / 马赛克强度） */
#props {
  position: fixed; display: none; z-index: 41;
  top: 54px; left: 50%; transform: translateX(-50%);
  background: rgba(40, 44, 52, 0.96); border-radius: 8px;
  padding: 8px 10px; gap: 9px; flex-direction: column; align-items: flex-start;
  box-shadow: 0 6px 20px rgba(0,0,0,.35); font-size: 13px; max-width: 94vw;
}
#props.active { display: flex; }
#props .prow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
#props .plabel { color: #cfd3da; font-size: 12px; min-width: 30px; }
#props .pval { color: #fff; min-width: 24px; text-align: right; font-size: 12px; }
#props .eyedropper-hex {
  color: #fff; font: 12px monospace;
  background: #2b2f37; border: 1px solid #4a4f59; border-radius: 4px;
  padding: 2px 6px; letter-spacing: 0.5px; cursor: default;
}
#props .eyedropper-copy {
  background: #409eff; color: #fff; border: none; border-radius: 5px;
  padding: 3px 10px; font-size: 12px; cursor: pointer; white-space: nowrap;
}
#props .eyedropper-copy:hover { background: #66b1ff; }
#props .eyedropper-copy.copied { background: #67c23a; }
#props .swatches { display: flex; gap: 5px; }
#props .swatch { width: 18px; height: 18px; border-radius: 4px; cursor: pointer; border: 2px solid transparent; }
#props .swatch.active { border-color: #fff; box-shadow: 0 0 0 1px #409eff; }
#props select {
  background: #2b2f37; color: #e6e6e6; border: 1px solid #4a4f59;
  border-radius: 5px; padding: 3px 6px; font-size: 13px;
}
#props input[type=range] { width: 130px; accent-color: #409eff; }
#props input[type=color] { width: 26px; height: 24px; border: none; background: none; padding: 0; cursor: pointer; }
#props .tbtn {
  border: 1px solid #4a4f59; background: transparent; color: #e6e6e6;
  padding: 4px 10px; border-radius: 5px; cursor: pointer; font-size: 13px;
}
#props .tbtn.active { background: #409eff; color: #fff; border-color: #409eff; }

#hint2 {
  position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
  background: rgba(40, 44, 52, 0.9); color: #fff; font-size: 12px;
  padding: 6px 14px; border-radius: 16px; pointer-events: none; z-index: 25;
}

#textInput {
  position: fixed; display: none; z-index: 50;
  border: 1px solid #409eff; background: rgba(0,0,0,.6); color: #ff4d4f;
  font-size: 16px; padding: 2px 4px; border-radius: 3px; outline: none; min-width: 80px;
}
</style>
