import { protocol, net } from "electron";

// 注册一个替代file://的协议，用于加载本地文件, 格式为'jlocal:///C:/test/a.png'
export function registerJlocalProtocol() {
  protocol.handle("jlocal", async (request) => {
    const reqUrl = decodeURIComponent(request.url);
    const filePath = reqUrl.slice("jlocal:///".length);
    return await net.fetch("file:///" + filePath);
  });
}
