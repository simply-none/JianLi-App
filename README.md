# readme

## 安装

环境：

- node: v20.13.1

安装：

- npm i -g cnpm
- cnpm i xxx

## 版本管理

`standard-version`用法：设置了`"release": "standard-version"`之后，可以根据需要执行相应的代码：

- 发布主版本：`npm run release -- --release-as major`
- 发布次版本：`npm run release -- --release-as minor`
- 发布补丁版本：`npm run release -- --release-as patch`
- 发布预发布版本：`npm run release -- --prerelease alpha`
- 发布beta版本：`npm run release -- --prerelease beta`
- 发布rc版本：`npm run release -- --prerelease rc`
- 发布自定义版本：`npm run release -- --release-as 1.1.0`

## 鸣谢

- [electron-vite-vue]

## 开发回顾

### 2025-03-07

小组件思维，某种模式下，可以自有选配各种不同组件到桌面上。

小组件：

- 时钟（时钟、倒计时、番茄钟）
- 待办事项
- 便签
- 天气
- 日历
- 

### 2025-03-06

electron框架中，控制台打印中文乱码，解决方法：在项目根目录输出命令`chcp 65001`

### 2025-03-02

消息通信，若是同步（sendSync）的，很可能会卡顿，所以需要异步通信（send）

### 2025-02-22

开启vue调试，安装vue/devtools，在html文件中加入devtools启动的脚本，启动命令npm run debug后才能npm run dev

### 2025-01-16

package.json中开发依赖应当放在devDependencies中，否则会报错

定时任务还是专用的库好，而非定时器
