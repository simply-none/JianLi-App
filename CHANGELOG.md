变更日志
## [1.0.0](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.7...v1.0.0) (2025-10-15)


### ♻️ Code Refactoring | 代码重构

* 依赖包移位 ([7e38c50](https://github.com/simply-none/JianLi-App/commit/7e38c505031d5690cf5e4be08d8e48df89134cab))


### ✨ Features | 新功能

* 新增获取系统字体功能 ([84d6697](https://github.com/simply-none/JianLi-App/commit/84d6697b74de44c699537cc6c4a90459a0373a26))
* 新增文件扫描和预览功能 ([217e698](https://github.com/simply-none/JianLi-App/commit/217e698b7c6b57241a517f5f2daba40398235601))
* 优化快捷键注册功能，添加展示隐藏应用快捷键 ([3c4c202](https://github.com/simply-none/JianLi-App/commit/3c4c20237f8b6dd7ac6a476ad66fb66eaf48e4bd))
* 增加目录扫描功能，用于查找特定后缀文件 ([35629fe](https://github.com/simply-none/JianLi-App/commit/35629fe0b7f3003c7b85089f2c4355926d112f84))

## [1.0.0-rc.7](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.4...v1.0.0-rc.7) (2025-09-02)


### ✨ Features | 新功能

* 番茄钟记录优化 ([52a5185](https://github.com/simply-none/JianLi-App/commit/52a5185e19b19999d31fb8816d784cb6a83d9e29))
* 全面使用sqlite本地数据库，替代electron-store ([ce9b320](https://github.com/simply-none/JianLi-App/commit/ce9b320242925cca60a442f30ab1f821ef8b27ea))
* 添加本地数据库splite3 ([77ba0e0](https://github.com/simply-none/JianLi-App/commit/77ba0e0bbb9f296ad36eaed1ecb89cf83db4585d))
* 添加番茄钟记录 ([453c8d1](https://github.com/simply-none/JianLi-App/commit/453c8d155231aa9737c33d4f49808e7b8cb32eb2))
* 添加快捷键功能 ([871598d](https://github.com/simply-none/JianLi-App/commit/871598d68c15beac290787a4991a64a6f2924efd))
* 优化剪切板功能 ([38725b3](https://github.com/simply-none/JianLi-App/commit/38725b3e705aae105393c0e8c617ce01fbaed8fb))
* 优化首次打开数据库报错的问题 ([1fcba8c](https://github.com/simply-none/JianLi-App/commit/1fcba8cd12d35a6e0dcd73f277c378633103d18c))
* 优化原有功能 ([570cf34](https://github.com/simply-none/JianLi-App/commit/570cf349c0d4280ea75621c849f0281f2e3ffda3))

## [1.0.0-rc.4](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.3...v1.0.0-rc.4) (2025-05-13)


### 🐛 Bug Fixes | Bug 修复

* distanceToNextStatus小组件问题修复 ([cd66dc4](https://github.com/simply-none/JianLi-App/commit/cd66dc474bdd9d2854b7693712dc8fe1a7b726bc))


### ♻️ Code Refactoring | 代码重构

* 首页锁屏按钮展示位置修改，改成右键设置显示 ([b0eccc7](https://github.com/simply-none/JianLi-App/commit/b0eccc716edc187ee5500ab76f7f7c22f7176b79))
* 小组件功能完善，可根据模式和内置选项自定义不同的状态，同时存储所有已经设置过的选项数据 ([7df3f25](https://github.com/simply-none/JianLi-App/commit/7df3f25ba5dac870cc9f840acdc8ea3d642b8091))


### ✨ Features | 新功能

* 剪切板试用 ([9e4a82b](https://github.com/simply-none/JianLi-App/commit/9e4a82bdf3612e949559f896a420296b3a9a0fba))
* 新增自定义模式+主题功能; 新增资源管理功能; ([06abd59](https://github.com/simply-none/JianLi-App/commit/06abd59c05382794d1a1810daa17c8c514080531))

## [1.0.0-rc.3](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2025-04-22)


### ✨ Features | 新功能

* 引入小组件DIY功能，初步添加小组件拖拽功能 ([732eff5](https://github.com/simply-none/JianLi-App/commit/732eff541a5f9873acf5f2bb77a1a176462b87a2))


### 🐛 Bug Fixes | Bug 修复

* 开发环境不进行开机自启动 ([6cedd02](https://github.com/simply-none/JianLi-App/commit/6cedd020c44239e02cdf13278daab0126d3f11e5))

## [1.0.0-rc.2](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2025-04-19)


### 🐛 Bug Fixes | Bug 修复

* **bug:** 项目依赖必须装在devDependencies上，不然打包报错 ([cc46fa9](https://github.com/simply-none/JianLi-App/commit/cc46fa9854a2f5d4b9b5f4d41214284eedd907fa))

## [1.0.0-rc.1](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.0...v1.0.0-rc.1) (2025-04-19)


### ✨ Features | 新功能

* 番茄钟小窗优化，新增开闭小窗功能；任务栏图标默认隐藏 ([166c3cc](https://github.com/simply-none/JianLi-App/commit/166c3cc8219806025ad7f0daa76491f9260b3687))
* 优化开机启动事件；首页模式hook封装；番茄钟小窗口封装； ([3ab0bba](https://github.com/simply-none/JianLi-App/commit/3ab0bba32ad053aeb0aa3b1fbabd4a9249135260))

## [1.0.0-rc.0](https://github.com/simply-none/JianLi-App/compare/v1.0.0-beta.3...v1.0.0-rc.0) (2025-03-08)


### ✨ Features | 新功能

* 加入standard version版本管理 ([ff8cd1a](https://github.com/simply-none/JianLi-App/commit/ff8cd1a488eeba928ce0605d4126b67370ae6fbc))
* 内容优化 ([b9f3b5a](https://github.com/simply-none/JianLi-App/commit/b9f3b5af78efaf0fa2c9d86eb1760982bc93e654))
* 替换默认背景图片 ([10f56df](https://github.com/simply-none/JianLi-App/commit/10f56df8a5c47dafa60be73f10549d6117121f93))
* 新增安全防护、应用缓存、文件关联、屏保模式功能； ([afd4ae1](https://github.com/simply-none/JianLi-App/commit/afd4ae181a1f98c7d498f119506b7e28d4b7e696))
* 新增番茄钟小窗口; ([fea04d1](https://github.com/simply-none/JianLi-App/commit/fea04d190b25f64ee3e8e15f39cce5c109807bb8))
* 增加文件复制转移功能 ([a5bea74](https://github.com/simply-none/JianLi-App/commit/a5bea74e545644136bd6130c41d71b37f6aa693d))
