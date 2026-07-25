/// <reference types="vite/client" />
/// <reference types="vite-plugin-jsonx/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 为了在Electron中使用，我们需要扩展全局的Window对象
interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer & {
    handlePromise: <T = any>(onName: string, args: ObjectType) => Promise<T>;
    // 剪贴板 API
    clipboard: {
      readText: () => string;
      writeText: (text: string) => void;
    };
    // TTS 语音合成 API
    tts: {
      // 通用接口
      speak: (text: string, options?: any) => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean }>;
      getVoices: () => Promise<any>;
      isAvailable: () => Promise<any>;
      // 系统 TTS
      system: {
        speak: (text: string, options?: any) => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean }>;
        getVoices: () => Promise<string[]>;
        isAvailable: () => Promise<boolean>;
      };
    };
  }
}

type ShowContentType = { error: boolean }

// 生成JavaScript对象的类型
type ObjectKey = string | number | symbol;
type ObjectType = Record<ObjectKey, any>;
