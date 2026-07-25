import { ipcMain } from 'electron';
import say from 'say';
import log from 'electron-log';

/**
 * TTS 配置选项接口
 */
interface TTSOptions {
  /** 语速，范围 0.5-2，默认 1 */
  rate?: number;
  /** 语音名称，可选，不选则使用默认 */
  voice?: string;
  /** 语言代码，如 'zh-CN' */
  lang?: string;
}

/**
 * 系统 TTS 相关函数
 */

/**
 * 获取可用的语音列表
 */
function getSystemVoices(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      say.getInstalledVoices((err, voices) => {
        if (err) {
          reject(new Error(typeof err === 'string' ? err : '获取语音列表失败'));
        } else {
          resolve(voices || []);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 系统 TTS 朗读
 */
function speakSystem(text: string, options: TTSOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const voice = options.voice || null;
    const speed = options.rate || 1;

    try {
      say.speak(text, voice, speed, (err) => {
        if (err) {
          reject(new Error(typeof err === 'string' ? err : '朗读失败'));
        } else {
          resolve();
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 停止系统 TTS
 */
function stopSystem(): Promise<void> {
  return new Promise((resolve) => {
    try {
      say.stop(() => {
        resolve();
      });
    } catch (err) {
      resolve();
    }
  });
}

/**
 * 初始化 TTS 模块
 * 注册所有 IPC 通信接口
 */
export function initTTS() {
  log.info('Initializing TTS module...');

  // ============ 系统 TTS (say 库) ============

  // 获取系统语音列表
  ipcMain.handle('tts:system:get-voices', async (): Promise<string[]> => {
    try {
      return await getSystemVoices();
    } catch (err) {
      log.error('Failed to get system TTS voices:', err);
      return [];
    }
  });

  // 系统 TTS 朗读
  ipcMain.handle('tts:system:speak', async (_event, text: string, options: TTSOptions = {}): Promise<{ success: boolean; error?: string }> => {
    try {
      await speakSystem(text, options);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  // 系统 TTS 停止
  ipcMain.handle('tts:system:stop', async (): Promise<{ success: boolean }> => {
    try {
      await stopSystem();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // 检测系统 TTS 是否可用
  ipcMain.handle('tts:system:is-available', async (): Promise<boolean> => {
    try {
      const voices = await getSystemVoices();
      return voices.length > 0;
    } catch {
      return false;
    }
  });

  // ============ 通用接口 ============

  // 获取所有语音列表
  ipcMain.handle('tts:get-voices', async (): Promise<any> => {
    const systemVoices = await getSystemVoices().catch(() => []);
    
    return {
      system: systemVoices,
    };
  });

  // 通用朗读（使用系统 TTS）
  ipcMain.handle('tts:speak', async (_event, text: string, options: TTSOptions = {}): Promise<{ success: boolean; error?: string }> => {
    try {
      await speakSystem(text, options);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Unknown error' };
    }
  });

  // 通用停止
  ipcMain.handle('tts:stop', async (): Promise<{ success: boolean }> => {
    try {
      await stopSystem();
      return { success: true };
    } catch {
      return { success: false };
    }
  });

  // 检测所有 TTS 可用性
  ipcMain.handle('tts:is-available', async (): Promise<any> => {
    const systemAvailable = (await getSystemVoices().catch(() => [])).length > 0;
    
    return {
      system: systemAvailable,
      web: true,
    };
  });

  log.info('TTS module initialized successfully');
}
