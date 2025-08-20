const requiredVersion = '22.0.0' // 最低要求的Node版本
const currentVersion = process.versions.node

function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number)
  const parts2 = v2.split('.').map(Number)
  
  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1
    if (parts1[i] < parts2[i]) return -1
  }
  return 0
}

// 检查nodejs主要版本是否满足要求
if (compareVersions(currentVersion.split('.')[0], requiredVersion.split('.')[0]) < 0) {
  console.error(`❌ 需要Node.js ${requiredVersion} 或更高版本，当前版本为 ${currentVersion}`)
  process.exit(1)
}

console.log(`✅ Node.js版本检查通过 (${currentVersion})`)
