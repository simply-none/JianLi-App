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
  }
}

type ShowContentType = { error: boolean }

// 生成JavaScript对象的类型
type ObjectKey = string | number | symbol;
type ObjectType = Record<ObjectKey, any>;
