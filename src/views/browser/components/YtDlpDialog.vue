<template>
  <!-- yt-dlp 解析对话框：展示格式清单，支持选择格式下载 -->
  <el-dialog
    v-model="visible"
    title="视频解析（yt-dlp）"
    width="560px"
    :append-to-body="true"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <div class="ytdlp-dialog" v-loading="loading" element-loading-text="正在解析视频信息…">
      <!-- 页面信息 -->
      <div class="video-info">
        <p class="video-title" :title="info?.title">{{ info?.title || url }}</p>
        <p v-if="info?.duration" class="video-duration">时长：{{ formatDuration(info.duration) }}</p>
      </div>

      <!-- 格式清单 -->
      <el-table v-if="sortedFormats.length > 0" :data="sortedFormats" size="small" max-height="320">
        <el-table-column label="清晰度" width="100">
          <template #default="{ row }">{{ qualityLabel(row) }}</template>
        </el-table-column>
        <el-table-column prop="ext" label="格式" width="70" />
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ kindLabel(row) }}</template>
        </el-table-column>
        <el-table-column label="大小" width="90">
          <template #default="{ row }">{{ row.size > 0 ? formatBytes(row.size) : "未知" }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :disabled="downloading" @click="onDownload(row)">
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else-if="!loading && parseError" class="parse-error">{{ parseError }}</p>

      <!-- 下载进度（支持暂停/继续：暂停终止进程保留断点，继续自动续传） -->
      <div v-if="activeJob" class="job-progress">
        <span class="job-label">{{ jobStageLabel }}</span>
        <el-progress :percentage="jobPercent" :stroke-width="8" class="job-bar" />
        <el-button v-if="jobStage === 'download' || jobStage === 'merge'" link size="small" type="warning" @click="onPause">
          暂停
        </el-button>
        <el-button v-else-if="jobStage === 'paused'" link size="small" type="primary" @click="onResume">
          继续
        </el-button>
        <el-button v-if="jobStage !== 'paused'" link size="small" type="danger" @click="onCancel">取消</el-button>
      </div>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="downloading" :disabled="!info" @click="onDownloadBest">
        直接下载最佳画质
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - yt-dlp 视频解析对话框
 * ------------------------------------------------------------------
 * 职责：调用主进程 yt-dlp 解析指定页面地址的格式清单（清晰度/大小/编码），
 * 用户可选择某一格式下载或直接下载最佳画质；展示下载/合并进度，
 * 支持取消任务。下载产物落在系统「下载」文件夹。
 */
import { computed, ref, watch } from "vue";
import { ElMessage } from "element-plus";
import {
  parseVideo,
  downloadVideo,
  cancelDownload,
  pauseDownload,
  resumeDownload,
  useYtDlpProgress,
  type YtDlpInfo,
  type YtDlpFormatItem,
  type YtDlpProgress,
} from "../composables/useYtDlp";

/** 对话框显隐（v-model:visible；open 时自动解析） */
const visible = defineModel<boolean>("visible", { default: false });

/** 组件入参 */
const props = defineProps<{
  /** 必填，要解析的页面地址 */
  url: string;
}>();

/** 解析结果 */
const info = ref<YtDlpInfo | null>(null);
/** 解析中 */
const loading = ref(false);
/** 解析失败信息 */
const parseError = ref("");
/** 下载中 */
const downloading = ref(false);
/** 活动任务 ID */
const activeJob = ref("");
/** 任务进度百分比 */
const jobPercent = ref(0);
/** 任务阶段 */
const jobStage = ref("");

/**
 * 格式清单：分辨率降序展示，纯音频排其后
 */
const sortedFormats = computed<YtDlpFormatItem[]>(() => {
  if (!info.value) return [];
  return [...info.value.formats].sort((a, b) => {
    const av = a.vcodec !== "none" ? a.height || 0 : -1;
    const bv = b.vcodec !== "none" ? b.height || 0 : -1;
    return bv - av;
  });
});

/** 任务阶段中文标签 */
const jobStageLabel = computed(() => {
  const map: Record<string, string> = {
    download: "下载中",
    merge: "合并音视频",
    paused: "已暂停（保留断点）",
    done: "下载完成",
    error: "下载失败",
  };
  return map[jobStage.value] || "处理中";
});

/**
 * 对话框打开时重置状态
 */
function onOpen() {
  info.value = null;
  parseError.value = "";
  jobPercent.value = 0;
  jobStage.value = "";
  activeJob.value = "";
  doParse();
}

/**
 * 解析页面格式清单
 */
async function doParse() {
  if (!props.url) return;
  loading.value = true;
  try {
    const res = await parseVideo(props.url);
    if (res) {
      info.value = res;
      if (res.formats.length === 0) parseError.value = "未解析到可用格式，该站可能暂不支持";
    } else {
      parseError.value = "解析失败：该站点可能不支持或网络异常";
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 订阅主进程进度推送（任务级；暂停阶段保留任务等待恢复）
 */
useYtDlpProgress((p: YtDlpProgress) => {
  if (!p.jobId || p.jobId !== activeJob.value) return;
  if (p.stage === "download") jobPercent.value = p.percent || 0;
  jobStage.value = p.stage;
  if (p.stage === "done") {
    ElMessage.success(p.message || "下载完成");
    downloading.value = false;
    activeJob.value = "";
  } else if (p.stage === "error") {
    ElMessage.error(p.message || "下载失败");
    downloading.value = false;
    activeJob.value = "";
  }
  // paused 阶段：保留 activeJob/downloading，等待用户点「继续」
});

/**
 * 暂停当前下载任务（终止 yt-dlp 进程，保留 .part 断点文件）
 */
async function onPause() {
  if (activeJob.value) {
    await pauseDownload(activeJob.value);
  }
}

/**
 * 继续当前下载任务（重启 yt-dlp 进程，自动从断点续传）
 */
async function onResume() {
  if (activeJob.value) {
    jobStage.value = "download";
    await resumeDownload(activeJob.value);
  }
}

/**
 * 启动下载任务
 * @param format 可选，格式条目；缺省下载最佳画质
 */
async function onDownload(format?: YtDlpFormatItem) {
  downloading.value = true;
  jobStage.value = "download";
  jobPercent.value = 0;
  const jobId = await downloadVideo(props.url, format?.formatId);
  if (jobId) {
    activeJob.value = jobId;
    ElMessage.info("已开始下载，文件将保存到系统「下载」文件夹");
  } else {
    ElMessage.error("下载启动失败");
    downloading.value = false;
  }
}

/** 直接下载最佳画质 */
function onDownloadBest() {
  onDownload();
}

/**
 * 取消当前下载任务
 */
async function onCancel() {
  if (activeJob.value) {
    await cancelDownload(activeJob.value);
  }
  downloading.value = false;
  activeJob.value = "";
}

/**
 * 清晰度标签（高度 + 帧率）
 * @param row 必填，格式条目
 * @returns 如 "1080P60" / "音频"
 */
function qualityLabel(row: YtDlpFormatItem): string {
  if (row.vcodec === "none") return "音频";
  return row.height ? `${row.height}P${row.fps && row.fps > 30 ? row.fps : ""}` : row.note || "视频";
}

/**
 * 类型标签（按编码判断）
 * @param row 必填，格式条目
 * @returns 如 "视频+音频" / "纯视频" / "纯音频"
 */
function kindLabel(row: YtDlpFormatItem): string {
  const hasV = row.vcodec !== "none";
  const hasA = row.acodec !== "none";
  if (hasV && hasA) return "视频+音频";
  if (hasV) return "纯视频";
  return "纯音频";
}

/**
 * 字节数转可读文本
 * @param bytes 必填，字节数
 * @returns 如 "1.2 MB"
 */
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * 秒数转时长文本
 * @param sec 必填，秒数
 * @returns 如 "12:34"
 */
function formatDuration(sec: number): string {
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

// 地址变化时清空旧解析结果
watch(
  () => props.url,
  () => {
    info.value = null;
  }
);
</script>

<style scoped lang="scss">
.ytdlp-dialog {
  min-height: 120px;
}

.video-info {
  margin-bottom: 10px;

  .video-title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-duration {
    margin: 0;
    font-size: 12px;
    color: var(--text-muted);
  }
}

.parse-error {
  margin: 12px 0;
  font-size: 13px;
  color: var(--color-danger, #f56c6c);
  text-align: center;
}

.job-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;

  .job-label {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .job-bar {
    flex: 1;
  }
}
</style>
