<template>
  <el-form class="" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">默认应用</div>
      </template>
    </el-form-item>
    <el-form-item label="默认应用"  class="mode-wrapper">
      <div v-for="(item, ext) in defaultAppPaths" :key="ext">
        <el-form-item :label="ext" :key="ext" class="mode-wrapper">
          {{ item.path }}
        </el-form-item>
      </div>
    </el-form-item>
  </el-form>
</template>

<script setup lang="tsx">
import { ref, reactive, watch, computed, toRaw, onMounted, unref } from 'vue';

const emit = defineEmits(['updateDefaultAppPaths'])

const appComputed = computed(() => {
  return (ext: string) => {
    return defaultAppPaths[`.${ext}`]?.path || ''
  }
})

// 常用文件的扩展名后缀列表
const commonExts = [
  // 视频
  '.mp4', '.avi', '.mov', '.mkv',
  // 音频
  '.mp3', '.wav', '.aac', '.flac', 
  // 图片
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp',
  // 文档
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.pdf', '.txt', '.md', '.html', '.xml', '.json',
  // 压缩包
  '.zip', '.rar', '.7z', '.tar.gz', '.tar.bz2',
  // 其他文件类型
  '.exe', '.dll', '.bat', '.sh', '.py', '.js', '.css', '.sql', '.ini', '.conf', '.log', '.bak', '.tmp', '.swp', '.o', '.a', '.so', '.dylib', 'dll', 'jar', 'war', 'ear', 'apk', 'ipa', 'ipsw', 'deb', '.rpm', '.pkg', '.apk', '.ipa', '.ipsw', '.deb', '.rpm', '.pkg'
]

const defaultAppPaths: Record<string, ObjectType> = reactive({})

function getDefaultFilePath (ext: string) {
  window.ipcRenderer.send('get-default-file-path', {ext})
}

window.ipcRenderer.on('get-default-file-path', (event, { ext, path }) => {
  console.log(path, `默认应用${ext}应用路径`)
    if (Object.prototype.toString.call(path) === '[object String]' && path !== '') {
      defaultAppPaths[ext] = {
        ext,
        path: path
      }
      emit('updateDefaultAppPaths', defaultAppPaths)
    }
})

// 获取所有安装的应用列表
window.ipcRenderer.handlePromise('get-installed-apps', {}).then(res => {
  console.log(res, '所有安装的应用列表')
})

onMounted(() => {
  commonExts.map((ext) => {
    getDefaultFilePath(ext)
  })
})

</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.cur-status {
  &-work {
    &::before {
      content: '•';
      color: #00ffbf;
      display: inline-block;
    }

    &::rest {
      content: '•';
      color: #ff0303;
      display: inline-block;
    }
  }
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.mode-ops {
  width: 100%;

  .mode-item {
    display: flex;
    margin-bottom: 10px;
  }

  .mode-label {
    width: 150px;
  }
}

:deep(.file-move) {
  .el-form-item__content {
    .el-form-item {
      margin-top: 10px;

      .el-form-item__label {
        height: unset;
        line-height: 1.2em;
        display: flex;
        align-items: center;
      }
    }
  }
}

.copy-include-list {
  display: flex;
  padding-top: 6px;
  gap: 6px;
}

.scan-handle {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.show-res {
  position: relative;
  height: 600px;
  .el-image {
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
  }
  video {
    height: 100%;
  }
  &-arrow {
    position: absolute;
    top: 50%;
    transform: translate(0, -50%);
    width: 36px;
    height: 100px;
    display: flex;
    align-items: center;
    padding: 3px;
    box-sizing: border-box;
    z-index: 1;
    cursor: pointer;
  }
  &-prev {
    left: 0;
  }
  &-next {
    right: 0;
  }
}


</style>
