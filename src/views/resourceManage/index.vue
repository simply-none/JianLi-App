<template>
  <layout-vue>
    <template #main>
      <div class="resource-page">
        <!-- Section 1: 上传文件 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="UploadCloud" />
            上传文件
          </h2>
          <div class="upload-card">
            <UploadVue :limit="10" :multiply="true" @updateData="handleChange" />
          </div>
        </div>

        <!-- Section 2: 文件列表 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="FolderOpen" />
            文件列表
          </h2>
          <div class="file-list-card">
            <div class="file-list" v-if="imageResourceCc.length > 0">
              <div
                v-for="(file, index) in imageResourceCc"
                :key="index"
                class="file-card"
                @click="previewFile(file)"
              >
                <div class="file-preview">
                  <el-image
                    v-if="getFileType(file.origin) === 'image'"
                    :src="fileProtocol + file.val"
                    fit="cover"
                    lazy
                  />
                  <FileIcon
                    v-else
                    :type="getFileType(file.origin)"
                    :size="64"
                  />
                </div>
                <div class="file-info">
                  <div class="file-name">{{ file.origin }}</div>
                  <div class="file-meta">
                    <span class="file-type" :class="getFileType(file.origin)">
                      {{ getFileTypeLabel(file.origin) }}
                    </span>
                  </div>
                </div>
                <div class="file-actions">
                  <el-button
                    size="small"
                    type="primary"
                    @click.stop="openFileLocation(file)"
                  >
                    打开位置
                  </el-button>
                  <el-button
                    size="small"
                    type="danger"
                    @click.stop="deleteFile(file, index as number)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <el-empty description="暂无上传文件" />
            </div>
          </div>
        </div>

        <!-- 预览对话框 -->
        <el-dialog
          v-model="previewVisible"
          :title="previewTitle"
          width="80%"
          top="5vh"
        >
          <div class="preview-content">
            <el-image
              v-if="previewFileType === 'image'"
              :src="fileProtocol + previewFileData?.val"
              fit="contain"
              style="max-height: 70vh"
            />
            <video
              v-else-if="previewFileType === 'video'"
              :src="fileProtocol + previewFileData?.val"
              controls
              style="max-width: 100%; max-height: 70vh"
            />
            <audio
              v-else-if="previewFileType === 'audio'"
              :src="fileProtocol + previewFileData?.val"
              controls
              style="width: 100%"
            />
            <pre v-else-if="previewFileType === 'text'" class="text-preview">
              {{ previewContent }}
            </pre>
            <iframe
              v-else-if="previewFileType === 'pdf'"
              :src="fileProtocol + previewFileData?.val"
              style="width: 100%; height: 70vh"
              frameborder="0"
            />
            <div v-else class="other-preview">
              <FileIcon :type="previewFileType" :size="64" class="mb-4" />
              <div>该文件类型不支持预览</div>
              <div class="mt-2 text-muted">文件名：{{ previewFileData?.origin }}</div>
              <el-button
                type="primary"
                class="mt-4"
                @click="openFileLocation(previewFileData)"
              >
                打开文件位置
              </el-button>
            </div>
          </div>
        </el-dialog>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage, ElMessageBox } from 'element-plus';
import LayoutVue from '@/components/layout.vue';
import LucideIcon from '@/components/LucideIcon.vue';
import FileIcon from '@/components/FileIcon.vue';
import useCacheSetStore from '@/store/useCacheSet';
import useResourceManage from '@/store/useResourceManage';
import { send, sendSync, setStore } from '@/utils/common';
import UploadVue from '@/components/upload.vue';
import { fileProtocol } from '@/var';

const { imageResourceC } = storeToRefs(useResourceManage());
const { setImageResource } = useResourceManage();
const imageResourceCc = ref(JSON.parse(JSON.stringify(imageResourceC.value || [])));

watch(
  () => imageResourceC.value,
  (n) => {
    imageResourceCc.value = JSON.parse(JSON.stringify(n || []));
  },
  {
    immediate: true,
    deep: true,
  }
);

const { fileCachePathC } = storeToRefs(useCacheSetStore());

const previewVisible = ref(false);
const previewFileData = ref<ObjectType | null>(null);
const previewContent = ref('');
const previewFileType = ref('');

const previewTitle = computed(() => {
  return previewFileData.value?.origin || '文件预览';
});

const imageExts = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tif', 'tiff',
  'psd', 'ai', 'eps', 'raw', 'svgz', 'avif', 'heic', 'heif', 'indd', 'jfif',
  'jpe', 'jpf', 'jpx', 'j2c', 'j2k', 'jp2', 'j2p', 'jxr', 'wbmp', 'xbm',
];

const videoExts = [
  'mp4', 'webm', 'ogg', 'mov', 'avi', 'flv', 'wmv', 'mkv', 'm4v', '3gp',
  '3g2', 'mpeg', 'mpg', 'mpe', 'mpv', 'm2v', 'm2ts', 'ts', 'vob', 'ogv',
  'qt', 'f4v', 'f4p', 'f4a', 'f4b', 'rm', 'rmvb', 'asf', 'divx', 'xvid',
  'amv', 'mts', 'm2ts', 'mxf', 'roq', 'nsv', 'mng', 'yuv', 'gifv', 'webm',
];

const audioExts = [
  'mp3', 'wav', 'ogg', 'aac', 'flac', 'wma', 'm4a', 'aiff', 'alac', 'dsf',
  'dff', 'ogg', 'opus', 'vorbis', 'pcm', 'au', 'snd', 'mid', 'midi', 'rmi',
  'm4b', 'm4p', 'aac', 'mpc', 'ape', 'wv', 'tak', 'tta', 'shn', 'wavpack',
  'mp2', 'mp1', 'amr', 'awb', '3ga', 'ogg', 'oga', 'spx', 'mka',
];

const textExts = [
  'txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'vue', 'xml', 'yaml', 'yml',
  'csv', 'tsv', 'log', 'ini', 'conf', 'cfg', 'env', 'bat', 'cmd', 'ps1',
  'sh', 'bash', 'zsh', 'fish', 'sql', 'python', 'py', 'java', 'cpp', 'c',
  'cxx', 'h', 'hpp', 'cs', 'go', 'rs', 'rust', 'swift', 'kt', 'kotlin',
  'rb', 'ruby', 'php', 'perl', 'pl', 'lua', 'dart', 'groovy', 'scala',
  'clj', 'cljs', ' cljs', 'edn', 'hs', 'haskell', 'ml', 'ocaml', 'elm',
  'purs', 'purescript', 'nim', 'zig', 'crystal', 'd', 'r', 'matlab', 'm',
  'v', 'vlang', 'svelte', 'astro', 'mdx', 'jsx', 'tsx', 'ejs', 'nunjucks',
  'jinja', 'twig', 'pug', 'haml', 'sass', 'scss', 'less', 'stylus',
];

const pdfExts = ['pdf'];
const fontExts = ['woff', 'woff2', 'ttf', 'otf', 'eot', 'svg', 'sfnt'];
const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz', 'lzma'];
const documentExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp'];

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (audioExts.includes(ext)) return 'audio';
  if (textExts.includes(ext)) return 'text';
  if (pdfExts.includes(ext)) return 'pdf';
  if (fontExts.includes(ext)) return 'font';
  if (archiveExts.includes(ext)) return 'archive';
  if (documentExts.includes(ext)) return 'document';
  return 'other';
}

function getFileTypeLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (imageExts.includes(ext)) return '图片';
  if (videoExts.includes(ext)) return '视频';
  if (audioExts.includes(ext)) return '音频';
  if (textExts.includes(ext)) return '文本';
  if (pdfExts.includes(ext)) return 'PDF';
  if (fontExts.includes(ext)) return '字体';
  if (archiveExts.includes(ext)) return '压缩包';
  if (documentExts.includes(ext)) return '文档';
  return '其他';
}

function previewFile(file: ObjectType) {
  previewFileData.value = file;
  previewFileType.value = getFileType(file.origin);

  if (previewFileType.value === 'text') {
    previewContent.value = '加载中...';
    loadTextContent(file.val);
  }

  previewVisible.value = true;
}

function loadTextContent(filePath: string) {
  try {
    const fullPath = filePath.startsWith('file://') ? filePath.slice(7) : filePath;
    const content = sendSync('read-file', fullPath);
    previewContent.value = content || '无法读取文件内容';
  } catch (e) {
    previewContent.value = '读取文件失败';
    console.error('读取文件失败', e);
  }
}

function openFileLocation(file: ObjectType | null) {
  if (!file?.val) return;
  const fullPath = file.val.startsWith('file://') ? file.val.slice(7) : file.val;
  send('open-file-in-assets-manager', { path: fullPath });
}

function deleteFile(file: ObjectType, index: number) {
  ElMessageBox.confirm(`确定要删除文件 "${file.origin}" 吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    imageResourceCc.value.splice(index, 1);
    const allVars = imageResourceCc.value.map((item: any) => ({
      val: item.val,
      name: item.name,
      origin: item.origin,
    }));
    setStore('imageResource', allVars);
    ElMessage.success('删除成功');
  }).catch(() => {
    // 取消删除
  });
}

function handleChange(data: any) {
  console.log(data, 'data');
}
</script>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
}

.resource-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }
  }

  .upload-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    transition: all 0.2s ease;

    &:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-card);
    }
  }

  .file-list-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .file-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
    width: 100%;
  }

  .file-card {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }
  }

  .file-preview {
    width: 100%;
    height: 120px;
    background: var(--bg-base);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .file-info {
    padding: 12px;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .file-name {
    font-size: 0.86rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.72rem;
  }

  .file-type {
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 500;

    &.image {
      background: rgba(99, 102, 241, 0.1);
      color: var(--color-primary);
    }

    &.video {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    &.audio {
      background: rgba(139, 92, 246, 0.1);
      color: #8b5cf6;
    }

    &.text {
      background: rgba(34, 197, 94, 0.1);
      color: #22c55e;
    }

    &.pdf {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }

    &.font {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }

    &.archive {
      background: rgba(6, 182, 212, 0.1);
      color: #06b6d4;
    }

    &.document {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    &.other {
      background: rgba(156, 163, 175, 0.1);
      color: var(--text-muted);
    }
  }

  .file-size {
    color: var(--text-muted);
  }

  .file-actions {
    padding: 0 12px 12px;
    display: flex;
    gap: 8px;

    button {
      flex: 1;
    }
  }

  .empty-state {
    padding: 40px 0;
  }

  .preview-content {
    padding: 20px;
    max-height: 70vh;
    overflow: auto;
  }

  .text-preview {
    background: var(--bg-base);
    padding: 16px;
    border-radius: var(--radius-card);
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 70vh;
    overflow: auto;
  }

  .other-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 0;
    color: var(--text-secondary);

    .text-muted {
      color: var(--text-muted);
    }
  }
}
</style>
