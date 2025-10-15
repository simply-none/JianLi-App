import { protocol, net } from "electron";
import path from 'path'
import fs from 'fs'
import colors from 'colors'

export function registerJlocalProtocolBefore() {
  // 注册自定义协议（必须在app ready之前）
  // protocol.registerSchemesAsPrivileged([
  //   {
  //     scheme: 'jlocal',
  //     privileges: {
  //       secure: true, // 让 Electron 信任这个方式就像信任网站的 HTTPS 一样
  //       supportFetchAPI: true, // 允许我们像在网页上那样请求资源
  //       standard: true, // 让这种方式的网址看起来像普通的网址
  //       bypassCSP: true, // 允许我们绕过一些安全限制
  //       stream: true, // 允许我们以流的形式读取文件，这对于大文件很有用
  //     },
  //   },
  // ])
}

// 注册一个替代file://的协议，用于加载本地文件, 格式为'jlocal:///C:/test/a.png'
export function registerJlocalProtocol() {
  protocol.handle("jlocal", async (request) => {
    const reqUrl = decodeURIComponent(request.url);
    const filePath = reqUrl.slice("jlocal:///".length);
    console.log(colors.bgBlack(filePath), 'filePath')
    if (filePath.includes('.mp4')) {
      const stats = fs.statSync(filePath)
      console.log(colors.bgBlack(filePath), 'filePath')
      
      return new Response(fs.createReadStream(filePath) as unknown as BodyInit, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': stats.size.toString(),
          'Accept-Ranges': 'bytes',
        }
      })
    }
    const res = await net.fetch("file:///" + filePath);
    console.log(res, 'registerJlocalProtocol')
    return res
  });
}
