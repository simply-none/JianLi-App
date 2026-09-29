# CHANGELOG.md

变更日志

## [Latest](https://github.com/simply-none/JianLi-App/compare/v26.8.23-rc.1...HEAD) (2026-09-29)

### ✨ Features | 新功能

* 剪贴板图片条目支持点击查看大图 ([0b6d82e](https://github.com/simply-none/JianLi-App/commit/0b6d82e75cb52eca1a2ae0491d6685cf1fac8438))
* 数据库管理工作台按设计稿全面重构，新增可视化数据流水线 ([83a1f3f](https://github.com/simply-none/JianLi-App/commit/83a1f3fadfa2910c919185492a60ef9785558179))
* 语音朗读接入 Piper/VITS 离线供应商并按子模型分组 ([a759b45](https://github.com/simply-none/JianLi-App/commit/a759b45caf9b9cf903dffeb9c3964318545f931a))
* 接入 Kokoro v1.1 本地离线 TTS 语音包（sherpa-onnx + worker_threads） ([3aad8f7](https://github.com/simply-none/JianLi-App/commit/3aad8f706193e6253753748fe271a6a9194a41fa))
* 遥控PC功能增强 ([8b5638e](https://github.com/simply-none/JianLi-App/commit/8b5638e388e33f8a88adaa2d48fb666d55e1134a))
* 隔空互传改名为流光扫传 ([64867f3](https://github.com/simply-none/JianLi-App/commit/64867f3777b821e423159271326e691fb4f75760))
* 小纸条功能 ([6fd76e4](https://github.com/simply-none/JianLi-App/commit/6fd76e4ed123c59538ff380163c642f7a28c7b2d))
* 增加pc遥控功能 ([7c45cdf](https://github.com/simply-none/JianLi-App/commit/7c45cdfd1943c3cdbcf31d89347602f28f37e44e))
* 增加数据库导入和启动图标优化 ([a16bd55](https://github.com/simply-none/JianLi-App/commit/a16bd55fbbec74dbdc49014400e3d45662202cca))
* 启动优化，右键菜单在启动后worker中进行 ([611fbf5](https://github.com/simply-none/JianLi-App/commit/611fbf5359c9f8c8e493ccd575e187664ba747ad))
* 统一菜单分组唯一数据源 ([0652e52](https://github.com/simply-none/JianLi-App/commit/0652e526a4645c6c2ea63466c8f2a9f7992b35c7))
* pc端新增传书功能页面 ([2e6c073](https://github.com/simply-none/JianLi-App/commit/2e6c07320f4bf3960e152dc1049ef6366dc2b016))
* 电子书新增传书功能 ([c96acfa](https://github.com/simply-none/JianLi-App/commit/c96acfa62100184125b0025f9abf3453a295245f))
* 双端日志同步 ([b55f001](https://github.com/simply-none/JianLi-App/commit/b55f001bbc34651a5884ed1765bb3e3319b0a54f))
* qrferry改为中文 ([a96b170](https://github.com/simply-none/JianLi-App/commit/a96b170768b56031ba8f45a377c989ca002823a9))
* 隔空互传 ([be743f3](https://github.com/simply-none/JianLi-App/commit/be743f3bb82429e0b4c4303fc43b6017ac7046bf))
* 文件互传优化 ([71cc716](https://github.com/simply-none/JianLi-App/commit/71cc716461a52284ce25c96388a787c1682bac78))
* 文件互传功能优化 ([ef98067](https://github.com/simply-none/JianLi-App/commit/ef980677275f59668bcce4c4b1bf00ef67f37b87))
* 文件互传优化 ([ed41a8d](https://github.com/simply-none/JianLi-App/commit/ed41a8d04ceec1a0fe20b8c3fb88d848dc5de93f))
* 新增互传模块 ([0380d3f](https://github.com/simply-none/JianLi-App/commit/0380d3fb1c98147b297c77b4728e5f0c881fca33))
* 同步功能完善 ([288a02a](https://github.com/simply-none/JianLi-App/commit/288a02a6280430e5cfd8f0eeaaafc1d2dc705aa0))
* 增加双端同步功能 ([a09fa2e](https://github.com/simply-none/JianLi-App/commit/a09fa2ec1dd1fafcac7d3ef37a911afd91c4f707))
* 应用 2FA 接入应用锁真实门禁（启动/锁屏强制校验） ([43113d9](https://github.com/simply-none/JianLi-App/commit/43113d909752c917700efb705f314d61ab9b8217))
* 系统右键菜单功能触发 ([1d88079](https://github.com/simply-none/JianLi-App/commit/1d88079494f31b263e22227445a2344ae221150a))
* 系统文件右键菜单功能增强 ([af2daf2](https://github.com/simply-none/JianLi-App/commit/af2daf219d85be286570d92817fc568d405a5580))
* 统一提醒引擎 ([3233ba9](https://github.com/simply-none/JianLi-App/commit/3233ba91deb8ec815a97a23d4f65192b46814ba3))
* 合并双 SQL 层，全面去除sql.ts文件 ([2f4da45](https://github.com/simply-none/JianLi-App/commit/2f4da450d17e979f96dc5b23e87dc4b2fe1be8b4))
* 统一导出风格 ([b74067b](https://github.com/simply-none/JianLi-App/commit/b74067b277382739618a14c20c9f690f0342bfd3))
* 主题对话新增导出主题 ([6179d55](https://github.com/simply-none/JianLi-App/commit/6179d55ce1b06097f5c7cc646bc97eeaa7b2645b))
* 主题对话新增正反向链接 ([0e2b219](https://github.com/simply-none/JianLi-App/commit/0e2b219335eb9aa4cf87f5a64beab7658398a8fc))
* 资源管理器右键菜单 ([df82c6a](https://github.com/simply-none/JianLi-App/commit/df82c6a547bbef071ae72849d3adb0e2a0471ada))
* 导入文件解密 ([a81a5e6](https://github.com/simply-none/JianLi-App/commit/a81a5e67917bda3fe637848961061a32c8780560))
* 文件保险箱功能增强 ([ff03243](https://github.com/simply-none/JianLi-App/commit/ff03243050d197718bfcf360685dd725c8ebd923))
* 新增私密文件保险箱 ([c8422ac](https://github.com/simply-none/JianLi-App/commit/c8422acb6e5db947268a7c9e0e783663ea72b17e))
* 快捷键页面ui排版调整 ([0968555](https://github.com/simply-none/JianLi-App/commit/096855587bc814b334bb847dd2ac282176174d96))
* pdf工具箱优化 ([2f55d87](https://github.com/simply-none/JianLi-App/commit/2f55d87fe06832dfbe3ce56d90a7c12f34e6b4c2))
* pdf工具箱 ([b216b7e](https://github.com/simply-none/JianLi-App/commit/b216b7ed54b075112f515a5e3df876f0c1bf41c7))
* 简历样式优化 ([024fafb](https://github.com/simply-none/JianLi-App/commit/024fafba122c0513adc0c4039b5ca4d8f9c59723))
* 新增elementplus适应主题 ([e427616](https://github.com/simply-none/JianLi-App/commit/e42761658a145a79a6d1840690917dcc0065a7c0))
* 数据获取页面的颜色随主题变化 ([ea4ab7f](https://github.com/simply-none/JianLi-App/commit/ea4ab7f54fc8bc74d6c6a6bc80a20be97bb8bd20))
* 收益看板增强 ([bd9cb21](https://github.com/simply-none/JianLi-App/commit/bd9cb21e9a94f7b86e553da752a25f366903b154))
* 统一密钥安全架构 ([a73bb7b](https://github.com/simply-none/JianLi-App/commit/a73bb7bd333bf5a962f06a971fb4cc847a3f4958))
* 密码管理 ([8cc7d38](https://github.com/simply-none/JianLi-App/commit/8cc7d38983f3169503213de28e6745c53b75a381))
* 2FA验证器 ([013e67b](https://github.com/simply-none/JianLi-App/commit/013e67b98cab90aa7756c6a8f6261ccbf2fe507f))
* 增加2FA功能 ([e820613](https://github.com/simply-none/JianLi-App/commit/e8206130fccef3908b9dab0ae587e900c4295204))
* 增加二维码功能 ([5bb741e](https://github.com/simply-none/JianLi-App/commit/5bb741eacec9a0c6f0c43c00106d68d5677c2630))
* 简历排版设置预览优化 ([2259759](https://github.com/simply-none/JianLi-App/commit/2259759d0b30fb792296a288ca1ac5027fed29e0))
* 简历预览导出优化 ([3b2296b](https://github.com/simply-none/JianLi-App/commit/3b2296b31edd74293f4c7d0343b6bd7595893faa))
* 简历自定义模块预览优化 ([98c9616](https://github.com/simply-none/JianLi-App/commit/98c961690a993f3bfb73fb1e4ecf8678038bf6e3))
* 简历增强自定义模板 ([ebe72af](https://github.com/simply-none/JianLi-App/commit/ebe72af9acc9062d8e07d62afdf5c3d6bfa46957))
* 增加简历 ([cbf6ec7](https://github.com/simply-none/JianLi-App/commit/cbf6ec7bcfbe111d5a0b01df90e953688b39fa14))
* 开发工具箱优化 ([9a84b30](https://github.com/simply-none/JianLi-App/commit/9a84b30b43194ae00a35967a4f31724f70c6114d))
* 开发工具箱 ([ba3f273](https://github.com/simply-none/JianLi-App/commit/ba3f27315bd94e78387f36280a93670e77ac49e4))
* 新建倒计时功能 ([770b5ad](https://github.com/simply-none/JianLi-App/commit/770b5ad85b299bb72e411681e187e2502170be58))
* 数据获取功能增强 ([6078130](https://github.com/simply-none/JianLi-App/commit/60781300be1408ff848a2be76dd1ee753060eb18))
* 新增数据提取功能 ([ffaad3e](https://github.com/simply-none/JianLi-App/commit/ffaad3e5dacbf9b9869f9cd868c2a3627d27cb43))
* 设置页面增加应用锁/隐私模式功能 ([872f8ef](https://github.com/simply-none/JianLi-App/commit/872f8efb31aeb93d3d6d439993c045428b1b8020))
* 备份恢复新增恢复功能 ([af0044f](https://github.com/simply-none/JianLi-App/commit/af0044fc675cf3f5153e25f2230bb31352eaff31))
* 新增备份与恢复页面 ([50c7d31](https://github.com/simply-none/JianLi-App/commit/50c7d31f290e4a0ff75f65a90100a4b99fab8748))
* 网络请求功能增强 ([a141d25](https://github.com/simply-none/JianLi-App/commit/a141d25eee4300f50403d6b71803c631b577fe70))
* 调色板新增能力 ([2a5f04e](https://github.com/simply-none/JianLi-App/commit/2a5f04efd87adfd634acda9d13eddd908cbb63b1))
* 网络请求样式美化 ([2ef24df](https://github.com/simply-none/JianLi-App/commit/2ef24dffbc0063013170ebbcd5e0ab57335b9e25))
* 优化调色板颜色显示的问题 ([6626c62](https://github.com/simply-none/JianLi-App/commit/6626c62465d96a77964d0a4d04d49d7286565799))
* 调色板功能加上透明色 ([43d7c62](https://github.com/simply-none/JianLi-App/commit/43d7c62d8c80926cd77996d3b23905d277f5fbc5))
* 增加调色板功能 ([d01cc91](https://github.com/simply-none/JianLi-App/commit/d01cc917e4dcdfb07a9274b8efa19f12b2673204))
* 网络请求导入cURL拆分 ([fdc3335](https://github.com/simply-none/JianLi-App/commit/fdc3335c163e251e6131abe4c95a11f7f27ab71b))
* 优化对接下载器和浏览器下载 ([f2899f2](https://github.com/simply-none/JianLi-App/commit/f2899f2b65c82fe7586bddafd3923a8a8191337f))
* 新增下载器功能 ([cbe121d](https://github.com/simply-none/JianLi-App/commit/cbe121d5361b2e06e13c24420fb8b9b09aa562c8))
* 资源嗅探增强 ([74c335a](https://github.com/simply-none/JianLi-App/commit/74c335a9343e8dfebd85e85d625c92bbafd0661a))
* 浏览器功能完善，增加书签、资源嗅探等功能 ([677a743](https://github.com/simply-none/JianLi-App/commit/677a74334dd37874d9e6afb41682111f3a32218d))
* 新增通用的顶部tab组件 ([51c3a33](https://github.com/simply-none/JianLi-App/commit/51c3a33005774f4e5e696142cbe50467f5f4753b))
* 主页模式改成tabs展示 ([8244cf1](https://github.com/simply-none/JianLi-App/commit/8244cf1741fcaf3fb4bbdc1c3d2c4e19ceeb5ff7))
* 修复新建习惯报错;修复习惯页热力图与列表「没数据 / 空白」;习惯打卡热力图改写为 ECharts 矩阵热力图（习惯 × 日期）;修复 ECharts 习惯热力图「中间突兀柱子 / tooltip 溢出」; ([f7ac444](https://github.com/simply-none/JianLi-App/commit/f7ac4448f5227b654edc827a7dfc8fd37db092c3))
* 通用习惯打卡的定位与落地顺序。定位 = 建在已 id 泛化提醒引擎之上的「复合提醒 + 记录 + 链式动作」系统，而非孤立功能；落地顺序（最小闭环优先）：① 数据模型+引擎复用 → ② 打卡小窗+通知 → ③ 链式动作注册表+1~2 个串接 → ④ 统计面板 → ⑤ 配置化。完整方案见 `docs/habit-checkin-design.md` ([8842ff0](https://github.com/simply-none/JianLi-App/commit/8842ff0ca60b4f14cbf7e030aea63be7b2311137))
* 提醒优化 ([08fccb7](https://github.com/simply-none/JianLi-App/commit/08fccb7bff1aa828241af97ec5f1f097073da5fc))
* 增加系统统一的命令面板 ([f5714d1](https://github.com/simply-none/JianLi-App/commit/f5714d1ed475921d38665726ee8d210c3c7443e5))
* 剪贴板功能增强，新增重复合并 + 使用次数、图片历史、粘贴为纯文本、全局快速粘贴面板 ([f0edd3e](https://github.com/simply-none/JianLi-App/commit/f0edd3e28c181dd4eca6416d8bb4e4211ae5b240))
* 新增虚拟滚动组件 ([218732e](https://github.com/simply-none/JianLi-App/commit/218732e4aa8290c200d9e1843aeb2cfdc2a67fa0))
* 自动更新换成auto-luanch ([c626ca4](https://github.com/simply-none/JianLi-App/commit/c626ca429602a00551dd4cedc53cfcf2d60479b8))
* 全局el-dialog新增全屏按钮 ([065cebb](https://github.com/simply-none/JianLi-App/commit/065cebbedfa019ffb80bed9d24de4d7af77ef1e0))
* 统一富文本编辑器 ([8e3697e](https://github.com/simply-none/JianLi-App/commit/8e3697ed90536f25e01df58154469c0abf27c1a4))
* 所有的home引入的组件都能显示空闲时段 ([191ec51](https://github.com/simply-none/JianLi-App/commit/191ec51450b538019775a152c99a39e80f3555ee))
* 空闲时段三端统一 ([0cc89f5](https://github.com/simply-none/JianLi-App/commit/0cc89f5a53ca44f1f822ca77f5f08ef33d76b9a5))
* 提醒增加空闲时段 ([8dd1d5e](https://github.com/simply-none/JianLi-App/commit/8dd1d5e17ceb547257d294f9dbfed7007367663e))
* 密保问题逻辑完善 ([34f872c](https://github.com/simply-none/JianLi-App/commit/34f872c376c82f2aac7505b62c3a47bcb4b4b0eb))
* 完善提醒开启关闭的流转管理 ([925b628](https://github.com/simply-none/JianLi-App/commit/925b62873ade9ef293654f0845407511fa5939b6))
* 文件关联优化文件扫描功能 ([eaf5778](https://github.com/simply-none/JianLi-App/commit/eaf5778814b5b1d18b7a2ade305b2202b4c6f5e9))
* 文件关联优化文件删除功能 ([df13360](https://github.com/simply-none/JianLi-App/commit/df13360b661c29edb73665113023a5decdb1c562))
* 文件关联优化文件转移功能 ([637a8f6](https://github.com/simply-none/JianLi-App/commit/637a8f62216210116f483fcb9bf2ccbd62d59c64))
* 文件关联新增重命名功能 ([fe5d958](https://github.com/simply-none/JianLi-App/commit/fe5d95814255a7d78ad124470d407e6f634115bb))
* epub设置优化，强制覆盖内部设置样式 ([4704881](https://github.com/simply-none/JianLi-App/commit/4704881559c87c9593a97e812f6f2cf1c93b1f9f))
* 电子书书架支持列表形式 ([36a9329](https://github.com/simply-none/JianLi-App/commit/36a932990783a27d6a21d3979083300f7bffb507))
* 电子书支持批量和文件夹导入 ([18cfd63](https://github.com/simply-none/JianLi-App/commit/18cfd63c184c1c04d2d9a4f96b265cbcc77a40cc))

### 🐛 Bug Fixes | Bug 修复

* 修复升级 Electron 44 后电子书点击打不开 ([2cc5ac7](https://github.com/simply-none/JianLi-App/commit/2cc5ac76d7de33fceef765570c30597e1f21693d))
* 修复 SQLite 事务嵌套报错并提升并发读写效率 ([75a007d](https://github.com/simply-none/JianLi-App/commit/75a007d894a1336b10d54691b0f721b4cdcc5e4c))
* 修复类型错误 ([b226eb5](https://github.com/simply-none/JianLi-App/commit/b226eb592b54f73dfdd7bb874a15bb4ac56b9af0))
* 修复启动报错 ([0654d0c](https://github.com/simply-none/JianLi-App/commit/0654d0cf511c6c5cf1c305bae8ce7083165bf805))
* 快捷键注册卡顿解决，原因是下拉选项：整页 ~78 张卡片（18 常用 + 60 路由），每卡 3 个 el-select，每个含 ~70 个 el-option → 全量常驻渲染 = 约 16,000 个组件实例，主线程被打爆。这就是"直接渲染停滞卡顿、点按钮延迟渲染也很慢"的原因 ([1e5b3ec](https://github.com/simply-none/JianLi-App/commit/1e5b3ecb1cefa60c5b548483333e36ce772281ff))
* 开发工具箱排版优化；网络诊断功能优化； ([98a89e8](https://github.com/simply-none/JianLi-App/commit/98a89e88c014255afe6dfbe572bcc22bdb53b997))
* 简历优化 ([4ac5e74](https://github.com/simply-none/JianLi-App/commit/4ac5e74f8b7d17933513b5509a84e6317d7b9033))
* 修复中英文边距问题 ([2904de6](https://github.com/simply-none/JianLi-App/commit/2904de6711863f5c73b621383b1ee734fd2fb18b))
* 自定义字体间距问题 ([5ec8ce9](https://github.com/simply-none/JianLi-App/commit/5ec8ce9fec595baa6bd4e2c3db9ac8b911cd6714))
* 超过2行截断隐藏的问题修复 ([92cb7f1](https://github.com/simply-none/JianLi-App/commit/92cb7f107caaa769a5d753e7b2d8a3de027e7a70))
* 网络请求集合问题修复 ([00faf8f](https://github.com/simply-none/JianLi-App/commit/00faf8faa73353ad25d3f293ae66be5dc0222a10))
* 导入cURL格式问题 ([4053dcd](https://github.com/simply-none/JianLi-App/commit/4053dcd06b053b6d9ee3bb17d8d3915bdbb95623))
* 命令面板@和#语法不生效解决 ([e7a0bfb](https://github.com/simply-none/JianLi-App/commit/e7a0bfb2426c010719afd6488ccb4e8f1487af09))
* 修复主页小组件不生效的问题 ([8d5b978](https://github.com/simply-none/JianLi-App/commit/8d5b9784cff3b641005b18dfdbb9776fb60e441c))
* 小组件语义化，仅提供主页引入的可拖拽的内容 ([0590fba](https://github.com/simply-none/JianLi-App/commit/0590fbaa5218f23dff5c9d75f91bea22bc39ba9c))
* 样式问题处理 ([1caa498](https://github.com/simply-none/JianLi-App/commit/1caa49885b8e5488817df138588a2afdb8e2300c))
* 修复ts类型错误 ([9f2626b](https://github.com/simply-none/JianLi-App/commit/9f2626b1e19f0c00c066d4cf0223c7461cd7758e))
* 休息时隐藏应用变为工作状态；强制锁屏时禁止隐藏应用 ([b7f18a2](https://github.com/simply-none/JianLi-App/commit/b7f18a2788351b51dd5e945ebde5dcac03122256))
* 修复小组件拖拽警告 ([adb9f02](https://github.com/simply-none/JianLi-App/commit/adb9f0287175d655a8d0f2e7c34606b315feff8a))
* 番茄钟提醒记录优化 ([059ba6a](https://github.com/simply-none/JianLi-App/commit/059ba6a3034b4b8f35892ce2c17c315507d72e27))
* 多端同步多模式下番茄钟状态 ([f34708e](https://github.com/simply-none/JianLi-App/commit/f34708e753c92ee254fc9ef6eea8c8890bc2d9f6))
* 优化密码解析失败的逻辑 ([c224cf0](https://github.com/simply-none/JianLi-App/commit/c224cf08ba00e723ee7fce8ad298f5c4f229fc74))
* 强制锁屏修复的中间修改（暂未完成） ([6c7e1c4](https://github.com/simply-none/JianLi-App/commit/6c7e1c4fb581857ba7c7390a0f79ddf68f70bc41))
* 修复多状态切换的逻辑 ([650984f](https://github.com/simply-none/JianLi-App/commit/650984f742bfca3dfd45ae10690c020a7d83722f))
* 设置右侧番茄钟倒计时优化 ([31b1564](https://github.com/simply-none/JianLi-App/commit/31b1564b937277349756d3fd3aa4efa552e7c48e))
* 优化番茄钟 ([80ce7e4](https://github.com/simply-none/JianLi-App/commit/80ce7e4d717c572c2cb00ae26fc233d04ccbc09b))
* 番茄钟逻辑优化 ([4d22c88](https://github.com/simply-none/JianLi-App/commit/4d22c888a09333ba1deb38de5fd3944a35050433))
* 修复番茄钟总是重新开始的问题 ([93f1d39](https://github.com/simply-none/JianLi-App/commit/93f1d39a9ceed81474c361a5966f6c3f205b5fa6))

### ⚡ Performance Improvements | 性能优化

* 修复鼠标快速移动卡顿——剪贴板图片轮询去掉重复 PNG 编码，并补齐索引与渲染端监听链开销 ([e55a92d](https://github.com/simply-none/JianLi-App/commit/e55a92d4446ce95e96ef17a3f4e31ffb0e329975))
* P1 性能优化——newSql 表缓存、store 读写异步化、启动链路并行化 ([f0b1337](https://github.com/simply-none/JianLi-App/commit/f0b1337e862962ffe3d1b914f9d735e82c6e2627))

### ♻️ Code Refactoring | 代码重构

* 高性能查询页重做——可视化流水线改为面向新手的 SQL 教学模式，并修复高级 SQL 筛选条件 OR 失效 ([7fef568](https://github.com/simply-none/JianLi-App/commit/7fef568661da4845555ddabb0789c1e49d340c74))
* 删除已被可归类笔记取代的 notebook / miniNotebook 页面及其依赖 ([4d832cd](https://github.com/simply-none/JianLi-App/commit/4d832cdd40d1e7c401e149168d6a804e467a11cf))
* 迁移旧 query-data/set-data 通道到 newSql 数据层 ([39e163f](https://github.com/simply-none/JianLi-App/commit/39e163fc3f3f32183bff896ebf3484d31ad830df))
* 记账重构 ([02548de](https://github.com/simply-none/JianLi-App/commit/02548dec561a672fa35f11f95f1df631ac7aa5a2))
* 资源管理重构 ([7e12e36](https://github.com/simply-none/JianLi-App/commit/7e12e368290c44e97dcd6b601ae75f0b2ce11797))
* 待办重构 ([549cee2](https://github.com/simply-none/JianLi-App/commit/549cee2259cd2425ce728d2a2134f7523cfa7e2d))
* 网络接口请求重构 ([ce9bb11](https://github.com/simply-none/JianLi-App/commit/ce9bb114cd3341858f198c0156041e2fec101c4a))
* 浏览器功能重构 ([10e51f6](https://github.com/simply-none/JianLi-App/commit/10e51f6514d960c0ab5e4778c12c38590f3ce31f))
* 天气页面重构，增加星标功能 ([127a356](https://github.com/simply-none/JianLi-App/commit/127a3563a45c85668a983fa207b214b17d78315a))
* 删除demo案例 ([fe33efb](https://github.com/simply-none/JianLi-App/commit/fe33efb8b3a9e91f34472c0a4e09b6c6010ed004))
* 剪切板功能重构 ([d1fc8c8](https://github.com/simply-none/JianLi-App/commit/d1fc8c8d12ee5392471bc96ae6c2bb0d06539423))
* 重构主页模式页面 ([f315a1a](https://github.com/simply-none/JianLi-App/commit/f315a1abb097709c118d30c88929e54b441e375b))
* 彻底重构提醒系统，将番茄钟融合进提醒 ([acb80d4](https://github.com/simply-none/JianLi-App/commit/acb80d4d0b61babe8603388e8d7c30942c262ea6))
* 重构番茄钟，和提醒统一逻辑 ([e0b0690](https://github.com/simply-none/JianLi-App/commit/e0b0690a5f2ee8f6ead1944be09a8e4aea861b1d))

### 📝 Documentation | 文档更新

* 文件互传清单 ([bf341c9](https://github.com/simply-none/JianLi-App/commit/bf341c95be9b17bad1f97da9a1209afa76032b5f))
* 封装应用skill ([64f4dc3](https://github.com/simply-none/JianLi-App/commit/64f4dc3d9f3d95be7de97e004fe04ef73a1a4d82))

### 🔧 Chores | 其他杂项

* 升级 Electron 36→44 并迁移剪贴板异步 API，全量清零类型错误 ([0616969](https://github.com/simply-none/JianLi-App/commit/0616969821873572ad0b60453bd6789cd9fbacc3))
* fix(ebook/tts): EPUB 朗读高亮复用 annotations 通道并修复卸载崩溃 ([243d2d7](https://github.com/simply-none/JianLi-App/commit/243d2d79a3471ad57c33df473ae833935b239f8d))

### ✅ Tests | 测试

* 删除无用的番茄钟代码 ([009b778](https://github.com/simply-none/JianLi-App/commit/009b778339a1f1d035e6b9a76b30bc3c6b47a8f6))

## [v26.8.23-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.20-rc.1...v26.8.23-rc.1) (2026-08-23)

### ✨ Features | 新功能

* 股票功能细化 ([1fbf8ac](https://github.com/simply-none/JianLi-App/commit/1fbf8ac78335abbbcaa186edf657ea5864feea34))
* 新增股票功能 ([c2f5844](https://github.com/simply-none/JianLi-App/commit/c2f5844b366a31b90d9cf27f6319488b629cc457))
* 文件关联页面功能优化 ([d37fc46](https://github.com/simply-none/JianLi-App/commit/d37fc46da417ed80ae03fc8c1fb7f35822e51432))
* 电子书阅读器翻页效果优化 ([b27d153](https://github.com/simply-none/JianLi-App/commit/b27d15347eb1d03e0bc89aefb65551fccfbf5dba))
* 记账功能增强，增加下钻功能；图表样式优化；设置优化； ([ac6377d](https://github.com/simply-none/JianLi-App/commit/ac6377d80e9a66abaa7fae63acdc086cbb64c790))
* 记账分类补全 ([dcb1bf5](https://github.com/simply-none/JianLi-App/commit/dcb1bf5cf3c57b785ade78131662e9338853d4a4))
* 新增记账功能 ([e90ddff](https://github.com/simply-none/JianLi-App/commit/e90ddffa256e012fc744f2f80d7931dcb999589c))

### 🐛 Bug Fixes | Bug 修复

* 修复控制台报错和警告 ([7c6ffff](https://github.com/simply-none/JianLi-App/commit/7c6ffff91cfbc7fd8a23cfeb4f5263e029bec162))

### ✅ Tests | 测试

* 删除ai产生的垃圾数据 ([8624920](https://github.com/simply-none/JianLi-App/commit/8624920559daf1a6dbec5bb3a3024f7524466fcb))

## [v26.8.20-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.18-rc.1...v26.8.20-rc.1) (2026-08-20)

### ✨ Features | 新功能

* 主题对话小窗口排版优化 ([cb1b4ed](https://github.com/simply-none/JianLi-App/commit/cb1b4ed3ac7354e86c4a99339a2e3fe2d74828fb))
* 新增主题对话小窗口 ([8116888](https://github.com/simply-none/JianLi-App/commit/81168886f168c25d657f28a4c2b44aaef37d2a3f))
* 待办增加记录进展 ([89eb4af](https://github.com/simply-none/JianLi-App/commit/89eb4af140f5ec4e4166e69a34487ef2c7f103f2))
* 增加多种待办状态类型 ([28cd627](https://github.com/simply-none/JianLi-App/commit/28cd62724a203dc2bc93c4a12720c6811a3ef5e6))
* 待办增加提醒 ([13c4b16](https://github.com/simply-none/JianLi-App/commit/13c4b1627925f7d51ae6b9914c6b90abde406b7e))
* 提醒结束后记录 ([c53b1f4](https://github.com/simply-none/JianLi-App/commit/c53b1f43adf2cb5be49a326ba22e22af3bf0b91f))
* 将定时提醒组件抽离成提醒页面 ([c4edc3c](https://github.com/simply-none/JianLi-App/commit/c4edc3cd91c54cdfc9c114920e3d5b05fd6f2384))
* 电子书阅读器导出笔记划线到主题对话 ([331f129](https://github.com/simply-none/JianLi-App/commit/331f129dd968cbb4e16ae38027d05ea8ad9d90c3))
* 主题对话列表置顶优化 ([9489ff8](https://github.com/simply-none/JianLi-App/commit/9489ff8519118b75daf256a2c56d0459c576c1a6))
* 主题对话图标样式优化 ([9e571ad](https://github.com/simply-none/JianLi-App/commit/9e571ad8cf5a4ca5b7db18f5bbab8c80a7dbe7b8))
* 主题对话新增跨主题引用和子主题功能 ([d8fea57](https://github.com/simply-none/JianLi-App/commit/d8fea578e81b4e982ecb354e91d9073fd182ab1a))
* 新增清空全部主题对话数据的按钮 ([ebf53ef](https://github.com/simply-none/JianLi-App/commit/ebf53efe3189f42fd31f6e047fe90e5cd3fab082))
* dialog弹窗高度优化 ([079d065](https://github.com/simply-none/JianLi-App/commit/079d065ed75097c2ac62997f74f678ef9e4bef60))
* 主题对话功能新增富文本输入支持 ([6f95a67](https://github.com/simply-none/JianLi-App/commit/6f95a67fca10e58520f06b23840026d6dd1b462c))
* 新增主题对话功能 ([a01bbb3](https://github.com/simply-none/JianLi-App/commit/a01bbb35d2bc6c1215c46d0b4f6821c5d722963c))

### 🐛 Bug Fixes | Bug 修复

* 修复[Vue warn]: Runtime directive used on component with non-element root node. The directives will not function as intended. ([eeefbd6](https://github.com/simply-none/JianLi-App/commit/eeefbd638925c557ab687ba2938f23a17e18023c))
* 文件上传报错修复 ([8e1ffee](https://github.com/simply-none/JianLi-App/commit/8e1ffee5a14618dda3e5a166293d669e68ad1e91))
* 提示还是改为3秒 ([0e14c0f](https://github.com/simply-none/JianLi-App/commit/0e14c0f88f2f78a397fa0d92c0fc5f84beac1f6e))
* 截图功能区居中展示 ([d71d0e1](https://github.com/simply-none/JianLi-App/commit/d71d0e1e92650d41f8ffc29ae8e98603f7e1263d))

### 🔧 Chores | 其他杂项

* 新增对话富文本插件 ([e06f27d](https://github.com/simply-none/JianLi-App/commit/e06f27d67c579c420031aa8e74f0201a631dfbdf))

## [v26.8.18-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.16-rc.1...v26.8.18-rc.1) (2026-08-18)

### ✨ Features | 新功能

* 贴图功能优化，增加贴图数量及其样式 ([ad7f940](https://github.com/simply-none/JianLi-App/commit/ad7f9408cc3990ba395d8bb4d63f610266a5e6a8))
* 截图增加贴图功能 ([30714df](https://github.com/simply-none/JianLi-App/commit/30714df73915ea1b308f35b2813b7f9cb9a8e194))
* 截图增加橡皮擦功能 ([a73f8d4](https://github.com/simply-none/JianLi-App/commit/a73f8d416914c077dd795a185c737532b2568f55))
* 截图增加记号笔标注 ([fa6e23e](https://github.com/simply-none/JianLi-App/commit/fa6e23e836b53446da671d7bcc1bc0993163d770))
* 截图工具增加吸管功能 ([060c5d7](https://github.com/simply-none/JianLi-App/commit/060c5d79ab6d20e17d29d92d0943fa2185728151))
* 截图工具路由页功能优化，增加截图记录、当前截图结果、显示器与窗口功能 ([795f980](https://github.com/simply-none/JianLi-App/commit/795f980ae4f6aa139fca107c1713e310c6c85566))
* 优化截图的表现 ([f75b913](https://github.com/simply-none/JianLi-App/commit/f75b91384bd235675667507a26dc5bed602ca412))
* 增加截图功能 ([14e87fb](https://github.com/simply-none/JianLi-App/commit/14e87fbc9f4a0f81564b25c34e86ff159936a671))

### 🐛 Bug Fixes | Bug 修复

* 修复截图铺不满整屏，少了任务栏的问题 ([df5ac50](https://github.com/simply-none/JianLi-App/commit/df5ac50a68d65f7b88b01e89dee0abdaf824330b))
* 截图标注增加滚轮效果 ([ef33fed](https://github.com/simply-none/JianLi-App/commit/ef33fed424737d4808c444948fa8f273c12550af))
* 矩形标注优化 ([60408c2](https://github.com/simply-none/JianLi-App/commit/60408c259f5f04c57dc2060332cd9de822b1dd5e))
* 箭头标注优化 ([1f32f62](https://github.com/simply-none/JianLi-App/commit/1f32f626e1cd68f3429d9031de442907730ca073))
* 修复截图标注内容不显示的问题 ([e2f0400](https://github.com/simply-none/JianLi-App/commit/e2f04001bf820e9b818f9abbda361f87eff62052))

## [v26.8.16-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.15-rc.1...v26.8.16-rc.1) (2026-08-16)

### ✨ Features | 新功能

* 改进通知的持续时间 ([3758708](https://github.com/simply-none/JianLi-App/commit/375870899cabdb5ea37c5b8ec2ad17c9b0459871))
* 电子书全屏设置和工具条优化 ([fe98c0e](https://github.com/simply-none/JianLi-App/commit/fe98c0efc387bf01bd281f70ae5733af3484ce96))
* 增加一次诗词首页类型 ([91b1e5b](https://github.com/simply-none/JianLi-App/commit/91b1e5b285f381da902b4e308cd31ea83059a5bf))
* 电子书笔记标注优化增强 ([20dd01b](https://github.com/simply-none/JianLi-App/commit/20dd01b1967f7e3175619e33dc2b0b186c3f5b9f))
* 电子书背景及其主题优化 ([c82542f](https://github.com/simply-none/JianLi-App/commit/c82542fda10e123801347521d48965d583df6b9e))
* 增加电子书分类 ([b9978c7](https://github.com/simply-none/JianLi-App/commit/b9978c77c30e09703525e4cd3afda8c33be50cc4))
* 标注弹窗显示优化 ([b120973](https://github.com/simply-none/JianLi-App/commit/b120973f7e68b47556168c5d2968bb1365335ee9))
* 增加电子书哈希，多个副本打开时回显相同的标注/书签/进度 ([d83a6bb](https://github.com/simply-none/JianLi-App/commit/d83a6bb203968f612f9b8d358eb909ed7ed1a085))
* 优化电子书翻页 ([2785790](https://github.com/simply-none/JianLi-App/commit/27857907e3c2511b92e817c867b6f1bf864fbf32))

## [v26.8.15-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.13-rc.1...v26.8.15-rc.1) (2026-08-15)

### ✨ Features | 新功能

* 优化快捷键注册，给所有的路由增加快捷键注册功能 ([0adb2da](https://github.com/simply-none/JianLi-App/commit/0adb2dad4361360a5eee3fc4a1ff94ac971fc0ab))
* 电子书的设置根据格式存储 ([8bb1b96](https://github.com/simply-none/JianLi-App/commit/8bb1b96675b8a6d1dc3c1ade6c13dc5f16b9ba80))
* 电子书增加PDF格式的支持；其他电子书功能优化 ([1614259](https://github.com/simply-none/JianLi-App/commit/1614259746b7ae51f37ece5d8d3d3b3f22f14ce7))
* 电子书功能增强 ([ddbd1c9](https://github.com/simply-none/JianLi-App/commit/ddbd1c9280089565e84e3f2b8065376011dca1c5))
* 电子书功能增强 ([e94b2f2](https://github.com/simply-none/JianLi-App/commit/e94b2f22f166c26745df5d28e2c0cfe00e0586aa))
* 优化电子书右侧功能弹窗分区展示 ([c320801](https://github.com/simply-none/JianLi-App/commit/c32080119694976328b1906a84888dbca40f6422))
* 电子书增加鼠标滚轮翻页 ([6718355](https://github.com/simply-none/JianLi-App/commit/671835508487ec63327eababba6b8dad84545c25))
* 电子书阅读器功能优化，顶部栏小屏操作优化，左右边缘点击翻页功能增强 ([73beb67](https://github.com/simply-none/JianLi-App/commit/73beb67c0dd30a609a2a7b16f9ad043f73742878))
* 番茄钟时长显示优化 ([83a902d](https://github.com/simply-none/JianLi-App/commit/83a902dd2591fd6db329ac150bc087435fce2441))
* 样式优化 ([63091c6](https://github.com/simply-none/JianLi-App/commit/63091c66b6eceb101ade29ed350db0861b443ca3))
* 新增定时提醒功能 ([c07b558](https://github.com/simply-none/JianLi-App/commit/c07b55821d689b151aa5bde5e5ca3963a3b99175))

### 🐛 Bug Fixes | Bug 修复

* 图标修复和样式修复 ([655abe9](https://github.com/simply-none/JianLi-App/commit/655abe90fff1c4d704264ce375c24d3d1b3c6092))
* txt划线功能修复 ([464581b](https://github.com/simply-none/JianLi-App/commit/464581b1438ed8bade416697abb3377ed31d164b))
* txt文本进度问题修复 ([658b83e](https://github.com/simply-none/JianLi-App/commit/658b83eb9fde8cf0814899bfe05b8422d40702f1))

### ♻️ Code Refactoring | 代码重构

* 电子书功能重构 ([db9ad3d](https://github.com/simply-none/JianLi-App/commit/db9ad3dee070344168258575f97f78c31d41d759))

## [v26.8.13-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.8.12-rc.1...v26.8.13-rc.1) (2026-08-13)

### ✨ Features | 新功能

* 优化进入窗口模式页面设置被初始化的逻辑；电子书功能增加笔记和划线导出功能； ([bf9e952](https://github.com/simply-none/JianLi-App/commit/bf9e952a2af261dafb6a78928bdd92713457bff8))
* 快捷键注册页面排版优化 ([11fd321](https://github.com/simply-none/JianLi-App/commit/11fd321fd1f1ce433238b95e30909b73c08eb2da))
* 修改主页模式的排版 ([5d9b88c](https://github.com/simply-none/JianLi-App/commit/5d9b88cdf830257116c9dc90354c8436b168f29a))
* 优化番茄钟的数据库记录 ([7bff356](https://github.com/simply-none/JianLi-App/commit/7bff35616d655cfa9454e6ed0173ca73c2faf210))

### 🐛 Bug Fixes | Bug 修复

* 修复typescript类型错误 ([117c211](https://github.com/simply-none/JianLi-App/commit/117c211fa6f4d45ab03a67c760b3a5318c96e146))

## [v26.8.12-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.7.25-rc.1...v26.8.12-rc.1) (2026-08-12)

### ✨ Features | 新功能

* 新增隐藏展示边栏；电子书设置优化；番茄钟在隐藏时直接开始工作； ([471af6d](https://github.com/simply-none/JianLi-App/commit/471af6d53262ffc1397d6281aced7ea7e1207b91))
* 电子书丰富扩展设置，增加主题、文字、背景 ([522f22f](https://github.com/simply-none/JianLi-App/commit/522f22fe8728fce5f4452a3cd9190ae1cce0934c))
* 电子书增加其他设置（翻页、分栏、边距等） ([38f747c](https://github.com/simply-none/JianLi-App/commit/38f747c25e533fcdcc3157d0393cfe3a03724570))
* 增加当前页数/总页数 ([6ea2ad6](https://github.com/simply-none/JianLi-App/commit/6ea2ad674cd1504aa5e23f36ea168062fe914708))
* 添加电子书功能 ([12d571a](https://github.com/simply-none/JianLi-App/commit/12d571a4710cf2ac71e8a2c69389c62f8a9936ab))

### 🐛 Bug Fixes | Bug 修复

* 修复阅读进度百分比为0的问题 ([9f31b8b](https://github.com/simply-none/JianLi-App/commit/9f31b8b4f766670a0a99e34a652b1e60cece7a10))
* 电子书功能优化修复 ([46fea06](https://github.com/simply-none/JianLi-App/commit/46fea060c8963efabd24a978ceecb61c9aaea409))
* 修复加载本地资源失败的问题 ([3e9ff4d](https://github.com/simply-none/JianLi-App/commit/3e9ff4dd14148407b9f5c27074d71091ed2190f7))

## [v26.7.25-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.7.11-rc.1...v26.7.25-rc.1) (2026-07-25)

### ✨ Features | 新功能

* 极简时钟主题文字显示优化 ([8d180e6](https://github.com/simply-none/JianLi-App/commit/8d180e66f606ec1d0b80a2cfe0d6951f1d089fad))
* 新增语音播报功能 ([cb2648d](https://github.com/simply-none/JianLi-App/commit/cb2648d8a9fe63d1be014285c4f9e52bbbf9c7ff))
* 新增番茄钟小窗口快捷键打开 ([ccac811](https://github.com/simply-none/JianLi-App/commit/ccac81123e040e4c17eaba86fa12b89138947bce))

### 🐛 Bug Fixes | Bug 修复

* 修复切换皮肤会展示其他窗口的问题 ([c624a78](https://github.com/simply-none/JianLi-App/commit/c624a78262deed6402f1294a84d2ea582beb240d))
* 优化部分内容 ([8d80e45](https://github.com/simply-none/JianLi-App/commit/8d80e4556f45335fe92dd37a37b5cdcb83db1e10))

## [v26.7.11-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.7.8-rc.1...v26.7.11-rc.1) (2026-07-11)

### ✨ Features | 新功能

* 新增待办功能 ([17bcc6d](https://github.com/simply-none/JianLi-App/commit/17bcc6d003ceca29092d7ed83593be38cf359e64))

### 🐛 Bug Fixes | Bug 修复

* 修复一些体验性问题 ([d0a071d](https://github.com/simply-none/JianLi-App/commit/d0a071df4ff92a94ffa488d75f7514aee67a16ff))

## [v26.7.8-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.7.4-rc.1...v26.7.8-rc.1) (2026-07-08)

### ✨ Features | 新功能

* 优化一些样式布局 ([2b188f4](https://github.com/simply-none/JianLi-App/commit/2b188f4aa846b3ecd96a6f611f3778ef5169177c))
* 优化数据库操作 ([363d7f0](https://github.com/simply-none/JianLi-App/commit/363d7f05be3a5dea86edf2c53c2f26ed1b90befe))
* 新增高性能数据库查询 ([0c76db9](https://github.com/simply-none/JianLi-App/commit/0c76db95ad89c9bf25445fcf2aa846f47799f86e))

### 🐛 Bug Fixes | Bug 修复

* cron表达式错误Unhandled Error: WARNING: Date in past. Will never be fired.问题修复 ([8b3873a](https://github.com/simply-none/JianLi-App/commit/8b3873ad550e00204873c43c6e4ff2af19e48471))

## [v26.7.4-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.7.2-rc.1...v26.7.4-rc.1) (2026-07-04)

### 🐛 Bug Fixes | Bug 修复

* 修复快速笔记主题切换不生效的问题 ([b116a5f](https://github.com/simply-none/JianLi-App/commit/b116a5f628736920f7efe928865d66caa2c5243b))
* 修复开发模式下任务栏图标问题；隐藏窗口增加确认提示； ([b5cefab](https://github.com/simply-none/JianLi-App/commit/b5cefab2bc459feda9dd0177f09336952f4e642c))

### ♻️ Code Refactoring | 代码重构

* handlePromise改成异步调用的形式 ([55bccb8](https://github.com/simply-none/JianLi-App/commit/55bccb8aa8ce8bea4a548eb194b15f7df9316e1a))

## [v26.7.2-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.28-rc.3...v26.7.2-rc.1) (2026-07-02)

### ✨ Features | 新功能

* 优化主页极简时钟下文字样式 ([fb4b932](https://github.com/simply-none/JianLi-App/commit/fb4b932618e601dfa296da72de8b78bb505e6666))
* 新增一个新主题配色 ([e18560d](https://github.com/simply-none/JianLi-App/commit/e18560da5deb9e89f2a13699005478a698621e41))
* 新增ui skill ([9e83054](https://github.com/simply-none/JianLi-App/commit/9e830548b5284533f1079d992339072e992424a0))
* 优化快速笔记的存储，临时实时保存在local storage中 ([884d327](https://github.com/simply-none/JianLi-App/commit/884d327598f59b4ee96ed1219f26029a83d61088))

### 🐛 Bug Fixes | Bug 修复

* 修复类型确实错误 ([42465a0](https://github.com/simply-none/JianLi-App/commit/42465a0252781438a45854b6a9eb4312890ca39a))
* 小窗口鼠标穿透功能调整，移入即可进行窗口内操作 ([686bb0f](https://github.com/simply-none/JianLi-App/commit/686bb0f27f65486a0130844a4abe96e48d040191))
* 修复快速记录窗口显示尺寸的问题 ([9386c54](https://github.com/simply-none/JianLi-App/commit/9386c54a3df8429c98dc65c54090615d0dfa21af))
* 修复一些页面的样式问题 ([e67a375](https://github.com/simply-none/JianLi-App/commit/e67a375b5773d656b7eb9def25b5403beca3d5c9))
* 修复快速笔记功能的类型错误 ([813b230](https://github.com/simply-none/JianLi-App/commit/813b23028301523acec452877e93972d2d2a3d44))

### ♻️ Code Refactoring | 代码重构

* 抽离主题和皮肤 ([d87c096](https://github.com/simply-none/JianLi-App/commit/d87c0967efa004c71f7cc19f92ec9db4cbf1baed))

### 🔧 Chores | 其他杂项

* 忽略trae生成的文档提交到git ([ba3a893](https://github.com/simply-none/JianLi-App/commit/ba3a8932f53ca7a3b50896f8e4a357c00c088471))
* 删除trae生成的文档 ([fd7b3d7](https://github.com/simply-none/JianLi-App/commit/fd7b3d74a72ffedfe3e134caa15abac2e4b4b6dd))

## [v26.6.28-rc.3](https://github.com/simply-none/JianLi-App/compare/v26.6.28-rc.2...v26.6.28-rc.3) (2026-06-28)

### 🔧 Chores | 其他杂项

* 发布脚本优化 ([d79a3a8](https://github.com/simply-none/JianLi-App/commit/d79a3a864c7240d191fed2619720b32e4de45b6a))

## [v26.6.28-rc.2](https://github.com/simply-none/JianLi-App/compare/v26.6.28-rc.1...v26.6.28-rc.2) (2026-06-28)

### ✨ Features | 新功能

* 新增笔记快速记录功能，支持快捷键唤出 ([aa04cbf](https://github.com/simply-none/JianLi-App/commit/aa04cbfdecd01c29b1e10337392c191d5e5be6d3))

## [v26.6.28-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.27-rc.1...v26.6.28-rc.1) (2026-06-28)

### ✨ Features | 新功能

* 更新几种主页模式主题 ([48f1855](https://github.com/simply-none/JianLi-App/commit/48f185537a83e3854617c7bb68dea7cc4abf0594))
* 新建浏览器页面功能 ([39ec87e](https://github.com/simply-none/JianLi-App/commit/39ec87ea51f0f33992c94016e74ba2214c6df174))

## [v26.6.27-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.26-rc.1...v26.6.27-rc.1) (2026-06-27)

### ✨ Features | 新功能

* 番茄钟小窗口新增五种主题皮肤 ([080432b](https://github.com/simply-none/JianLi-App/commit/080432bc4aed9db8044b743ba31415b363d741ec))

## [v26.6.26-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.25-rc.1...v26.6.26-rc.1) (2026-06-26)

### ♻️ Code Refactoring | 代码重构

* 重构剩下功能的样式排版 ([407fc15](https://github.com/simply-none/JianLi-App/commit/407fc15efd3dc58eaecc782cd6df4b97c6ce4f01))

## [v26.6.25-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.23-rc.2...v26.6.25-rc.1) (2026-06-25)

### ✨ Features | 新功能

* 新增天气页面 ([a21cd7e](https://github.com/simply-none/JianLi-App/commit/a21cd7ec6cab32838d78f128b280bc07a30cde2f))
* 开机自启动优化，当安装时如果杀毒软件拦截了该权限的处理 ([7bd79d3](https://github.com/simply-none/JianLi-App/commit/7bd79d37dc46690b9b47374163cfaf02f7a30f02))

### ♻️ Code Refactoring | 代码重构

* 重构已有功能的样式排版 ([f07a582](https://github.com/simply-none/JianLi-App/commit/f07a582f40bafb7576139ae5b1cbf829db49b64f))

## [v26.6.23-rc.2](https://github.com/simply-none/JianLi-App/compare/v26.6.23-rc.1...v26.6.23-rc.2) (2026-06-23)

### 🐛 Bug Fixes | Bug 修复

* 修复主题新增时的打包报错 ([09723a2](https://github.com/simply-none/JianLi-App/commit/09723a25f92281c47554aca9f3b2fc3f044a4b14))

## [v26.6.23-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.17-rc.1...v26.6.23-rc.1) (2026-06-23)

### ✨ Features | 新功能

* 新增主题，资源管理主题优化 ([21833a2](https://github.com/simply-none/JianLi-App/commit/21833a20262d9c589854e488789e0e312988a91d))

## [v26.6.17-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.15-rc.1...v26.6.17-rc.1) (2026-06-17)

### ✨ Features | 新功能

* 新增自动更新功能 ([288e080](https://github.com/simply-none/JianLi-App/commit/288e08054ac7ecc5fe5094e0cf1a8fd4b13e63a5))

## [v26.6.15-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.11-rc.4...v26.6.15-rc.1) (2026-06-15)

### 🔧 Chores | 其他杂项

* 添加命令行提示，用于推送到远程 ([4b011da](https://github.com/simply-none/JianLi-App/commit/4b011daa145a369f3817dc27bb8e2a49d38e8c76))
* 版本生成时，包含最新的changelog ([3db4f68](https://github.com/simply-none/JianLi-App/commit/3db4f68aac170b2d41850754385c5ca524ba984c))
* 功能日志包含最新提交，同时不包含版本提交 ([2068e73](https://github.com/simply-none/JianLi-App/commit/2068e73f44d072ecc54a25ca20d1742ea627a1e2))

## [v26.6.11-rc.4](https://github.com/simply-none/JianLi-App/compare/v26.6.11-rc.3...v26.6.11-rc.4) (2026-06-11)

### ✨ Features | 新功能

* 番茄钟记录优化，新增图表形式 ([1fb8031](https://github.com/simply-none/JianLi-App/commit/1fb803110ddcaa340cec596954039f18a2cb91e2))
* 新增系统主题 ([3ce3c67](https://github.com/simply-none/JianLi-App/commit/3ce3c67a77fca6ee18eb0f60e6524d9f97c4aa9f))
* 优化ai提交 ([e9162b0](https://github.com/simply-none/JianLi-App/commit/e9162b08f35bda0c25a1980fcc4f9bfe1c65c7a3))
* Layout页面现代化改造 ([e9f7f97](https://github.com/simply-none/JianLi-App/commit/e9f7f9789a0725c03c8aa4942e63218758bc6c50))
* 优化编辑器样式 ([8aa0b78](https://github.com/simply-none/JianLi-App/commit/8aa0b785b841b5b94701f4eb59ce7a5c7e1370a7))
* 首页编辑器样式更新 ([612d5d2](https://github.com/simply-none/JianLi-App/commit/612d5d263b9ada007af538d16ccdf7bff8f2165d))

### 🔧 Chores | 其他杂项

* 优化功能日志生成 ([a9d458e](https://github.com/simply-none/JianLi-App/commit/a9d458e1b0986e6e7c24199aef4e5f361d15fa71))
* 版本更新必须生成日志 ([921c200](https://github.com/simply-none/JianLi-App/commit/921c200a7270b60c43632270f955a78640f36ef6))

## [v26.6.11-rc.3](https://github.com/simply-none/JianLi-App/compare/v26.6.11-rc.2...v26.6.11-rc.3) (2026-06-11)

### 🔧 Chores | 其他杂项

* 番茄钟记录优化，新增图表形式 ([e59215b](https://github.com/simply-none/JianLi-App/commit/e59215b3752c062be48c7414394479ded3260eb2))

## [v26.6.11-rc.2](https://github.com/simply-none/JianLi-App/compare/v26.6.11-rc.1...v26.6.11-rc.2) (2026-06-11)

### 🔧 Chores | 其他杂项

* 新增系统主题 ([39c273a](https://github.com/simply-none/JianLi-App/commit/39c273a4eac3ca00d2295171a3a756ac6b7424a9))

## [v26.6.11-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.6.10-rc.1...v26.6.11-rc.1) (2026-06-11)

### ✨ Features | 新功能

* Layout页面现代化改造 ([0ffcbdf](https://github.com/simply-none/JianLi-App/commit/0ffcbdf264bc73d9668f819a61e983e7ead5fb96))

### 🔧 Chores | 其他杂项

* 优化ai提交 ([942becc](https://github.com/simply-none/JianLi-App/commit/942becc051cc870d4e87c68701bdf40be06e4cd4))

## [v26.6.10-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.4.27-rc.2...v26.6.10-rc.1) (2026-06-10)

### 🔧 Chores | 其他杂项

* 优化编辑器样式 ([02a9f17](https://github.com/simply-none/JianLi-App/commit/02a9f171777d1116a554e9176ae3f2c0acf795dc))

## [v26.4.27-rc.2](https://github.com/simply-none/JianLi-App/compare/v26.4.27-rc.1...v26.4.27-rc.2) (2026-04-27)

### 🔧 Chores | 其他杂项

* 首页编辑器样式更新 ([c38b6fe](https://github.com/simply-none/JianLi-App/commit/c38b6fea41d968a4f9a38ac8a1ddfd92cb1bc644))

## [v26.4.27-rc.1](https://github.com/simply-none/JianLi-App/compare/v26.2.12-rc.2...v26.4.27-rc.1) (2026-04-27)

### ✨ Features | 新功能

* 首页编辑器显示优化 ([ebdaf9c](https://github.com/simply-none/JianLi-App/commit/ebdaf9c1a201e6a24fb0d7cf4b1a5c88e5e36edf))
* 新增版本号增强标识 ([aa8a287](https://github.com/simply-none/JianLi-App/commit/aa8a28795ee7ad0c39e0c7d8e5c455403f2dfb55))

## [v26.2.12-rc.2](https://github.com/simply-none/JianLi-App/compare/v26.2.12-rc.1...v26.2.12-rc.2) (2026-02-12)

### 🔧 Chores | 其他杂项

* 优化版本生成方式，使用日期的方式生成版本 ([70ef8a9](https://github.com/simply-none/JianLi-App/commit/70ef8a9613da6e7eee8339c4e810347966de08e8))

## [v26.2.12-rc.1](https://github.com/simply-none/JianLi-App/compare/v1.0.1...v26.2.12-rc.1) (2026-02-12)

### ✨ Features | 新功能

* 主窗口新增笔记组件 ([5b27850](https://github.com/simply-none/JianLi-App/commit/5b278509d5db25cebc8e819c192d05f9648a951b))
* 新增主进程错误日志记录功能 ([a03237f](https://github.com/simply-none/JianLi-App/commit/a03237f6f9021f48ef85c2e0faebfc461d2993c0))

### 🐛 Bug Fixes | Bug 修复

* 修复定时任务过时的问题 ([79d05a7](https://github.com/simply-none/JianLi-App/commit/79d05a75aae7546fd176e9fec28a5f59233cf153))
* 修复诸多问题，包括资源管理，笔记本，剪切板，自启动 ([591a40d](https://github.com/simply-none/JianLi-App/commit/591a40def792cfc46d54fcf807078db9023826cf))

## [v1.0.1](https://github.com/simply-none/JianLi-App/compare/v1.0.0...v1.0.1) (2026-01-23)

### ✨ Features | 新功能

* 词数据保留一种类型获取方式，删除json ([43ccfe0](https://github.com/simply-none/JianLi-App/commit/43ccfe01929f1cae0b980dc2006bd439494657f4))
* 首屏增加小组件类型【任务提醒】 ([8d4f513](https://github.com/simply-none/JianLi-App/commit/8d4f5132736061161f8bc444620747d7cd3e8ab0))
* 任务提醒优化 ([dd3bec8](https://github.com/simply-none/JianLi-App/commit/dd3bec893686a5d0ade6743e038c08cbebb898b6))
* 新增任务提醒功能，用于提醒各类事项 ([5868251](https://github.com/simply-none/JianLi-App/commit/58682513c2789c76f156d0836b9bac42f7a191c0))
* 部分细节优化，解决进程资源占用导致的页面卡顿问题 ([9542401](https://github.com/simply-none/JianLi-App/commit/954240124a8d1a72812217730869d2f455ef43ad))
* 增加简易流程功能 ([7cfe978](https://github.com/simply-none/JianLi-App/commit/7cfe9785c3c7384906d5da0e8c45ab16f938e872))
* 加入流程编排器功能 ([9e22ccf](https://github.com/simply-none/JianLi-App/commit/9e22ccfddf45faf0a0778faa998c238abb332d20))
* 新增获取系统信息功能 ([dd09ccd](https://github.com/simply-none/JianLi-App/commit/dd09ccdd87b69b2e4bcc9e27f7654d867ff912c7))
* 新增自动化脚本，让浏览器任务自动化 ([0c173cc](https://github.com/simply-none/JianLi-App/commit/0c173cc09d1f891c352102a5888f81be06f02dfb))
* 输入组件拼写检查功能关闭 ([0d057b1](https://github.com/simply-none/JianLi-App/commit/0d057b1aeb68d10dc39e94b6e63aa79be097020c))
* 字体同步到小窗口 ([06c1c3b](https://github.com/simply-none/JianLi-App/commit/06c1c3bd653f9bd831c4924cae0b8cbab25d6d39))
* 修改字体 ([8791798](https://github.com/simply-none/JianLi-App/commit/87917985574d0495c9b5b9f001c38d82c6757e59))

### 🐛 Bug Fixes | Bug 修复

* 小窗口模式下出现标题的问题修复 ([2c4b667](https://github.com/simply-none/JianLi-App/commit/2c4b66740af584242497b2ed2d2dd551efaefa6f))
* 优化数据读写操作，让程序不会频繁弹窗报错 ([7178b65](https://github.com/simply-none/JianLi-App/commit/7178b65a0e65a3de471e03bad273be8a67d79243))
* 任务提醒小窗口的时间取下一次时间 ([6b183c1](https://github.com/simply-none/JianLi-App/commit/6b183c105f8867c022c863bc35e5da39941697a4))
* 将小窗口改为透明色，减少频繁重绘刷新导致的眩晕感 ([07b1faa](https://github.com/simply-none/JianLi-App/commit/07b1faa4baf997daab8d8e8cdfef631f80e2b8a3))
* 任务提醒事件多次加载的问题 ([44c60ba](https://github.com/simply-none/JianLi-App/commit/44c60bab2143491b2701834e92adbefc9f186b39))
* 剪切板复制不了的问题 ([0cfd345](https://github.com/simply-none/JianLi-App/commit/0cfd3451384b8f3afbff1cdfd4ce7a9ec8783e14))
* 流程执行报错优化; feat: 增加关于tab页; ([4d53150](https://github.com/simply-none/JianLi-App/commit/4d53150665e2aa8dc63f4dc11c6858bf16bc95c2))

### ♻️ Code Refactoring | 代码重构

* 删除中文以外的语言包 ([8438357](https://github.com/simply-none/JianLi-App/commit/84383578e458f21c0e85218f7661faf97beb5f53))
* 内容优化，自动脚本流程构想加上流程图设计 ([46a5c56](https://github.com/simply-none/JianLi-App/commit/46a5c564f664781dd1f54b39a1b0f302c8b0b899))
* 控制台警告清除 ([d855011](https://github.com/simply-none/JianLi-App/commit/d855011f9ec0072fa027fc79abacafbe8d92259c))

## [v1.0.0](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.10...v1.0.0) (2025-10-15)

## [v1.0.0-rc.10](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.9...v1.0.0-rc.10) (2025-12-25)

### ✨ Features | 新功能

* 任务提醒优化 ([dd3bec8](https://github.com/simply-none/JianLi-App/commit/dd3bec893686a5d0ade6743e038c08cbebb898b6))
* 新增任务提醒功能，用于提醒各类事项 ([5868251](https://github.com/simply-none/JianLi-App/commit/58682513c2789c76f156d0836b9bac42f7a191c0))

### 🐛 Bug Fixes | Bug 修复

* 剪切板复制不了的问题 ([0cfd345](https://github.com/simply-none/JianLi-App/commit/0cfd3451384b8f3afbff1cdfd4ce7a9ec8783e14))
* 流程执行报错优化; feat: 增加关于tab页; ([4d53150](https://github.com/simply-none/JianLi-App/commit/4d53150665e2aa8dc63f4dc11c6858bf16bc95c2))

### ♻️ Code Refactoring | 代码重构

* 删除中文以外的语言包 ([8438357](https://github.com/simply-none/JianLi-App/commit/84383578e458f21c0e85218f7661faf97beb5f53))

## [v1.0.0-rc.9](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.8...v1.0.0-rc.9) (2025-11-12)

### ✨ Features | 新功能

* 部分细节优化，解决进程资源占用导致的页面卡顿问题 ([9542401](https://github.com/simply-none/JianLi-App/commit/954240124a8d1a72812217730869d2f455ef43ad))
* 增加简易流程功能 ([7cfe978](https://github.com/simply-none/JianLi-App/commit/7cfe9785c3c7384906d5da0e8c45ab16f938e872))
* 加入流程编排器功能 ([9e22ccf](https://github.com/simply-none/JianLi-App/commit/9e22ccfddf45faf0a0778faa998c238abb332d20))
* 新增获取系统信息功能 ([dd09ccd](https://github.com/simply-none/JianLi-App/commit/dd09ccdd87b69b2e4bcc9e27f7654d867ff912c7))
* 新增自动化脚本，让浏览器任务自动化 ([0c173cc](https://github.com/simply-none/JianLi-App/commit/0c173cc09d1f891c352102a5888f81be06f02dfb))
* 输入组件拼写检查功能关闭 ([0d057b1](https://github.com/simply-none/JianLi-App/commit/0d057b1aeb68d10dc39e94b6e63aa79be097020c))
* 字体同步到小窗口 ([06c1c3b](https://github.com/simply-none/JianLi-App/commit/06c1c3bd653f9bd831c4924cae0b8cbab25d6d39))
* 修改字体 ([8791798](https://github.com/simply-none/JianLi-App/commit/87917985574d0495c9b5b9f001c38d82c6757e59))

### ♻️ Code Refactoring | 代码重构

* 内容优化，自动脚本流程构想加上流程图设计 ([46a5c56](https://github.com/simply-none/JianLi-App/commit/46a5c564f664781dd1f54b39a1b0f302c8b0b899))
* 控制台警告清除 ([d855011](https://github.com/simply-none/JianLi-App/commit/d855011f9ec0072fa027fc79abacafbe8d92259c))

## [v1.0.0-rc.8](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.7...v1.0.0-rc.8) (2025-10-15)

### ✨ Features | 新功能

* 新增文件扫描和预览功能 ([217e698](https://github.com/simply-none/JianLi-App/commit/217e698b7c6b57241a517f5f2daba40398235601))
* 新增获取系统字体功能 ([84d6697](https://github.com/simply-none/JianLi-App/commit/84d6697b74de44c699537cc6c4a90459a0373a26))
* 增加目录扫描功能，用于查找特定后缀文件 ([35629fe](https://github.com/simply-none/JianLi-App/commit/35629fe0b7f3003c7b85089f2c4355926d112f84))
* 优化快捷键注册功能，添加展示隐藏应用快捷键 ([3c4c202](https://github.com/simply-none/JianLi-App/commit/3c4c20237f8b6dd7ac6a476ad66fb66eaf48e4bd))

### ♻️ Code Refactoring | 代码重构

* 依赖包移位 ([7e38c50](https://github.com/simply-none/JianLi-App/commit/7e38c505031d5690cf5e4be08d8e48df89134cab))

## [v1.0.0-rc.7](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.4...v1.0.0-rc.7) (2025-09-02)

### ✨ Features | 新功能

* 添加快捷键功能 ([871598d](https://github.com/simply-none/JianLi-App/commit/871598d68c15beac290787a4991a64a6f2924efd))
* 优化原有功能 ([570cf34](https://github.com/simply-none/JianLi-App/commit/570cf349c0d4280ea75621c849f0281f2e3ffda3))
* 优化首次打开数据库报错的问题 ([1fcba8c](https://github.com/simply-none/JianLi-App/commit/1fcba8cd12d35a6e0dcd73f277c378633103d18c))
* 优化剪切板功能 ([38725b3](https://github.com/simply-none/JianLi-App/commit/38725b3e705aae105393c0e8c617ce01fbaed8fb))
* 全面使用sqlite本地数据库，替代electron-store ([ce9b320](https://github.com/simply-none/JianLi-App/commit/ce9b320242925cca60a442f30ab1f821ef8b27ea))
* 添加本地数据库splite3 ([77ba0e0](https://github.com/simply-none/JianLi-App/commit/77ba0e0bbb9f296ad36eaed1ecb89cf83db4585d))
* 番茄钟记录优化 ([52a5185](https://github.com/simply-none/JianLi-App/commit/52a5185e19b19999d31fb8816d784cb6a83d9e29))
* 添加番茄钟记录 ([453c8d1](https://github.com/simply-none/JianLi-App/commit/453c8d155231aa9737c33d4f49808e7b8cb32eb2))

## [v1.0.0-rc.4](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.3...v1.0.0-rc.4) (2025-05-13)

### ✨ Features | 新功能

* 剪切板试用 ([9e4a82b](https://github.com/simply-none/JianLi-App/commit/9e4a82bdf3612e949559f896a420296b3a9a0fba))
* 新增自定义模式+主题功能; 新增资源管理功能; ([06abd59](https://github.com/simply-none/JianLi-App/commit/06abd59c05382794d1a1810daa17c8c514080531))

### 🐛 Bug Fixes | Bug 修复

* distanceToNextStatus小组件问题修复 ([cd66dc4](https://github.com/simply-none/JianLi-App/commit/cd66dc474bdd9d2854b7693712dc8fe1a7b726bc))

### ♻️ Code Refactoring | 代码重构

* 小组件功能完善，可根据模式和内置选项自定义不同的状态，同时存储所有已经设置过的选项数据 ([7df3f25](https://github.com/simply-none/JianLi-App/commit/7df3f25ba5dac870cc9f840acdc8ea3d642b8091))
* 首页锁屏按钮展示位置修改，改成右键设置显示 ([b0eccc7](https://github.com/simply-none/JianLi-App/commit/b0eccc716edc187ee5500ab76f7f7c22f7176b79))

## [v1.0.0-rc.3](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2025-04-22)

### ✨ Features | 新功能

* 引入小组件DIY功能，初步添加小组件拖拽功能 ([732eff5](https://github.com/simply-none/JianLi-App/commit/732eff541a5f9873acf5f2bb77a1a176462b87a2))

### 🐛 Bug Fixes | Bug 修复

* 开发环境不进行开机自启动 ([6cedd02](https://github.com/simply-none/JianLi-App/commit/6cedd020c44239e02cdf13278daab0126d3f11e5))

## [v1.0.0-rc.2](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2025-04-19)

### 🐛 Bug Fixes | Bug 修复

* 项目依赖必须装在devDependencies上，不然打包报错 ([cc46fa9](https://github.com/simply-none/JianLi-App/commit/cc46fa9854a2f5d4b9b5f4d41214284eedd907fa))

## [v1.0.0-rc.1](https://github.com/simply-none/JianLi-App/compare/v1.0.0-rc.0...v1.0.0-rc.1) (2025-04-19)

### ✨ Features | 新功能

* 优化开机启动事件；首页模式hook封装；番茄钟小窗口封装； ([3ab0bba](https://github.com/simply-none/JianLi-App/commit/3ab0bba32ad053aeb0aa3b1fbabd4a9249135260))
* 番茄钟小窗优化，新增开闭小窗功能；任务栏图标默认隐藏 ([166c3cc](https://github.com/simply-none/JianLi-App/commit/166c3cc8219806025ad7f0daa76491f9260b3687))

## [v1.0.0-rc.0](https://github.com/simply-none/JianLi-App/compare/v1.0.0-beta.3...v1.0.0-rc.0) (2025-03-08)

### ✨ Features | 新功能

* 加入standard version版本管理 ([ff8cd1a](https://github.com/simply-none/JianLi-App/commit/ff8cd1a488eeba928ce0605d4126b67370ae6fbc))
* 新增番茄钟小窗口; chore: 重构主进程index.ts文件，将各个功能放到独立的文件中 ([fea04d1](https://github.com/simply-none/JianLi-App/commit/fea04d190b25f64ee3e8e15f39cce5c109807bb8))
* 替换默认背景图片 ([10f56df](https://github.com/simply-none/JianLi-App/commit/10f56df8a5c47dafa60be73f10549d6117121f93))
* 新增安全防护、应用缓存、文件关联、屏保模式功能； ([afd4ae1](https://github.com/simply-none/JianLi-App/commit/afd4ae181a1f98c7d498f119506b7e28d4b7e696))
* 内容优化 ([b9f3b5a](https://github.com/simply-none/JianLi-App/commit/b9f3b5af78efaf0fa2c9d86eb1760982bc93e654))
* 增加文件复制转移功能 ([a5bea74](https://github.com/simply-none/JianLi-App/commit/a5bea74e545644136bd6130c41d71b37f6aa693d))

## [v1.0.0-beta.3](https://github.com/simply-none/JianLi-App/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2025-02-28)

### ✨ Features | 新功能

* 内容重构 ([0103a45](https://github.com/simply-none/JianLi-App/commit/0103a4525b304ab009514dff48591a1260fa1c44))
* 重构暂存 ([2b972cc](https://github.com/simply-none/JianLi-App/commit/2b972cc5b1c98a76371ea8e6282d020c870ff6d9))
* 新增自定义字体 ([38bde18](https://github.com/simply-none/JianLi-App/commit/38bde187e639facb752a131946e78460a6355807))

### 🐛 Bug Fixes | Bug 修复

* 优化休息后功能失效的问题 ([e65dd4b](https://github.com/simply-none/JianLi-App/commit/e65dd4b65a1094715f4cde52c96e53463f07fd17))

## [v1.0.0-beta.2](https://github.com/simply-none/JianLi-App/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2025-02-20)

### ✨ Features | 新功能

* 新增休息时背景 ([8915523](https://github.com/simply-none/JianLi-App/commit/8915523fd5c0255a8b7213636134afff581b93c2))

## [v1.0.0-beta.1](https://github.com/simply-none/JianLi-App/compare/v1.0.0-alpha.3...v1.0.0-beta.1) (2025-02-10)

### ✨ Features | 新功能

* 定时任务细节优化 ([6ce8a4c](https://github.com/simply-none/JianLi-App/commit/6ce8a4ce575e3088db88aa8ebdde18503a74b985))
* 新增小窗口模式 ([f61b307](https://github.com/simply-none/JianLi-App/commit/f61b30705c39f8fa76b1ed22fc8f0479e8cc4075))

### 🔧 Chores | 其他杂项

* 发布使用版本1 ([652dd92](https://github.com/simply-none/JianLi-App/commit/652dd92b5ae96365a10623e94871297acf5ed7aa))

## [v1.0.0-alpha.3](https://github.com/simply-none/JianLi-App/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2025-01-16)

### ✨ Features | 新功能

* 计时使用定时任务替代 ([dc31a40](https://github.com/simply-none/JianLi-App/commit/dc31a4032b7c27d494b981e500f0ecaa13a6cab1))
* 中午11：50-13：30休息 ([79987ff](https://github.com/simply-none/JianLi-App/commit/79987ff322a0f0268810dc59b4bc369d6d96b77a))
* 添加打包应用图标；添加休眠策略模块；修改强制工作设置逻辑 ([dcac19e](https://github.com/simply-none/JianLi-App/commit/dcac19e26371b9879b4ddc6016b174eeab9c4c7e))
* 修改倒计时问题，包括开始/结束工作时间点的赋值 ([ddd5172](https://github.com/simply-none/JianLi-App/commit/ddd51728d360814fe4548642691198b176b6c31f))
* 增加托盘图标右击事件 ([1424335](https://github.com/simply-none/JianLi-App/commit/1424335867ca0aba3e2b1d6a2a58adffb1ad0ae6))
* 增加开机自启动功能 ([b73ec11](https://github.com/simply-none/JianLi-App/commit/b73ec11ef7896476d904e7fa17361c209ef41a23))
* 首页优化，增加随机宋词展示功能 ([1659e37](https://github.com/simply-none/JianLi-App/commit/1659e372b54c2a543daaefcc6c4de0fe6d601cce))
* 修复应用报错，以及打包白屏问题 ([37c6e1e](https://github.com/simply-none/JianLi-App/commit/37c6e1e3f5c2fd6c4b73caa92549a5997b8506e8))
* element-plus中文包修改 ([664c66c](https://github.com/simply-none/JianLi-App/commit/664c66cb6fb959a03b4922abcd39a2d22cc19021))

### 🔧 Chores | 其他杂项

* 项目初始化，完成基本功能 ([401adb2](https://github.com/simply-none/JianLi-App/commit/401adb2802aa626f616e358151f46c6a0db27ace))

## [v1.0.0-alpha.2](https://github.com/simply-none/JianLi-App/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2024-11-03)

### ✨ Features | 新功能

* 首页优化，增加随机宋词展示功能 ([2a4b69b](https://github.com/simply-none/JianLi-App/commit/2a4b69b040b1b24193473342ac12946d7f6de80c))

## [v1.0.0-alpha.1](https://github.com/simply-none/JianLi-App/compare/v1.0.0-alpha.1) (2024-11-03)

### ✨ Features | 新功能

* 修复应用报错，以及打包白屏问题 ([dc93c59](https://github.com/simply-none/JianLi-App/commit/dc93c5983ceffe5432843dd63e0c3f9f13de7c8f))
* element-plus中文包修改 ([3463cc9](https://github.com/simply-none/JianLi-App/commit/3463cc9ed5d1cd878125640c5e51818a932b3933))

### 🔧 Chores | 其他杂项

* 项目初始化，完成基本功能 ([63a086e](https://github.com/simply-none/JianLi-App/commit/63a086ecb72a7098cf51264b37cdce5342ca6f36))

