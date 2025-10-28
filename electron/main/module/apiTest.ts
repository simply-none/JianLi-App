import { BrowserWindow, ipcMain } from "electron";
import axios from "axios";
import puppeteer, { Locator, LocatorEvent } from 'puppeteer';
import colors from "colors";
import { win } from "./mainWindow.ts";

export function initApiTest() {
  ipcMain.on("api-test", (e, obj: any) => {
    console.log(obj);
    // 接口测试，发送接口请求
    axios({
      url: obj.url,
      method: obj.method,
      data: obj.data,
      headers: obj.headers,
      params: obj.params,
    }).then(res => {
      console.log(colors.bgBlue(JSON.stringify(res.data, null, 2)));
      win.webContents.send("api-test", res.data);
    }).catch(err => {
      console.log(err);
      win.webContents.send("api-test", err);
    })
  });

  // 爬虫测试
  // 接下来的计划：
  // 页面自动化参数完全可配置
  // 请求接口数据
  ipcMain.on("spider-test", async (e, obj: ObjectType) => {
    console.log(obj);
    // 接口测试，发送接口请求
    const browser = await puppeteer.launch({
      headless: obj.headless || false,
      slowMo: obj.slowMo || 50,
      timeout: obj.timeout || 300000,
      executablePath: obj.executablePath || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page = await browser.newPage();

    // Navigate the page to a URL.
    await page.goto(obj.url || 'https://cn.bing.com/');

    // Set screen size.
    await page.setViewport({ width: obj.width || 1080, height: obj.height || 1024 });

    // Type into search box using accessible input name.
    await page.locator(obj.searchBoxSelector || '.sb_form_q').fill( obj.searchText || '天气');
    // await page.keyboard.press('Enter');
    // const el = await page.$('.sb_form_q')
    // await el?.click()

    // 获取到元素点击不生效一直在等待，需要通过js语句进行点击，而不是通过puppeteer的click方法
    await page.evaluate((selector) => {
      (document.querySelector(selector) as HTMLElement).click();
    }, obj.searchButtonSelector || '.search');


    // Wait and click on first result.

    // Locate the full title with a unique string.
    // await page.waitForNavigation({ 
    //   waitUntil: 'networkidle2',
    //   timeout: 30000 
    // });

    await page.waitForSelector(obj.searchResultSelector || '.b_respl')

     // 获取搜索结果页面内容
    const searchResults = await page.evaluate(() => {
      return {
        // 获取页面标题
        title: document.title,
        // 获取主要搜索结果区域
        mainContent: document.body.innerHTML,
        // 获取当前URL
        url: window.location.href,
      };
    });

    console.log(colors.bgBlue(JSON.stringify(searchResults, null, 2)));

    win.webContents.send("spider-test", searchResults);

    await browser.close();
  });
}
