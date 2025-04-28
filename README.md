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

## 待处理事项

[x] 多次切换强制切换当前状态会导致小窗口和主窗口的时间（倒计时）不一致
[x] 第一次番茄钟主页不进入休息状态，需要手动进入设置再返回，才会进入休息，实际上后台已经开始计时休息了

## 开发回顾

### 2025-04-24

小组件订阅，是采用拖拽生成（左侧是小组件列表，右侧是空页面），还是采用弹窗选中组件的形式？

### 2025-04-23

小组件思维下，所有的模式，所有的组件，都是可以自由搭配属性的，所以，模式下的小组件，都应该是小组件本身属性的备份。其数据结构类似：

```javascript
// 模式结构：
const homeMode = {
  // 工作模式
  work: {
    // 工作模式属性
    label: 'xxx',
    value: 1,
    // 该模式共有css样式
    css: {
      // 该模式的背景颜色
      backgroundColor: 'xxx',
    },
    // 该模式下组件集合
    components: {
      // 组件名称
      bigDateTime: {
        // 组件属性
        // ...
        // 组件样式
        css: {
          // 组件字体
          font: 'xxx',
        }
      }
    }
  }
}
```

### 2025-03-10

小组件思维下，所有的模式都是引入小组件的，而非将组件固定在某种特定的模式中。

故而：

- 小组件应当单独维护一个状态库，包括不限于：
  - 组件名称、唯一标识
  - 组件特有的样式，包括字体、背景、颜色、定位
- 模式引入小组件，模式应当含有，模式全局化的样式
- 维护一个css样式的列表，其中可以包括：样式名称（字体），对应的css样式（font），以及样式的默认值，然后在模式中选择这些存在的样式，不存在的样式则不能够进行选择

### 2025-03-07

小组件思维，某种模式下，可以自有选配各种不同组件到桌面上。

小组件：

- 时钟（时钟、倒计时、番茄钟）
- 待办事项
- 便签
- 天气
- 日历
- 事件提醒（周期性事件、一次性事件），比如纪念日，喝水提醒
- 随时记录（记录自己的想法、记录自己的生活）

### 2025-03-06

electron框架中，控制台打印中文乱码，解决方法：在项目根目录输出命令`chcp 65001`

### 2025-03-02

消息通信，若是同步（sendSync）的，很可能会卡顿，所以需要异步通信（send）

### 2025-02-22

开启vue调试，安装vue/devtools，在html文件中加入devtools启动的脚本，启动命令npm run debug后才能npm run dev

### 2025-01-16

package.json中开发依赖应当放在devDependencies中，否则会报错

定时任务还是专用的库好，而非定时器
