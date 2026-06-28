import { ipcMain } from "electron";
import axios from "axios";

interface BingImage {
  url: string;
  title: string;
  copyright: string;
  date: string;
}

// Bing 图片缓存
let cachedBingImage: BingImage | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 缓存24小时

async function fetchBingImage(): Promise<BingImage | null> {
  try {
    const response = await axios.get('https://www.bing.com/HPImageArchive.aspx', {
      params: {
        format: 'js',
        idx: 0,
        n: 1,
        mkt: 'zh-CN'
      },
      timeout: 10000
    });

    if (response.data && response.data.images && response.data.images.length > 0) {
      const image = response.data.images[0];
      const startdate = image.startdate || '';
      const formattedDate = startdate.length === 8
        ? `${startdate.slice(0, 4)}-${startdate.slice(4, 6)}-${startdate.slice(6, 8)}`
        : '';
      return {
        url: 'https://www.bing.com' + image.url,
        title: image.title || '每日必应',
        copyright: image.copyright || '',
        date: formattedDate
      };
    }
    return null;
  } catch (error) {
    console.error('获取 Bing 图片失败:', error);
    return null;
  }
}

export function initBing() {
  ipcMain.handle("get-bing-image", async () => {
    try {
      // 检查缓存
      const now = Date.now();
      if (cachedBingImage && (now - cacheTimestamp) < CACHE_DURATION) {
        return cachedBingImage;
      }

      // 获取新的 Bing 图片
      const image = await fetchBingImage();
      if (image) {
        cachedBingImage = image;
        cacheTimestamp = now;
      }
      return image;
    } catch (error) {
      console.error("Bing 图片 API 处理失败:", error);
      return { error: (error as Error).message };
    }
  });
}