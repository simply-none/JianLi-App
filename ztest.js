
import { exec } from 'child_process';
import util from 'util';
import { writeFileSync, readFileSync } from 'fs';

// console.log(new Date().toLocaleString())
// exec('reg query HKCR /s /f "Command" /d /k', {
//   maxBuffer: 1024 * 1024 * 2000,
//   windowsHide: false,
// }, (error, stdout, stderr) => {
//   if (error) {
//     console.error(`执行 ls 命令时出错: ${error.message}`);
//     return;
//   }
//   if (stderr) {
//     console.error(`ls 命令 stderr: ${stderr}`);
//     return;
//   }
//   // 追加写入
//   // 先写入空白
//   console.log(new Date().toLocaleString())
//   writeFileSync('results.json', '\n\n\n\n\n', { flag: 'a' });
//   writeFileSync('results.json', stdout, { flag: 'a' });
// });

// 读取results.json文件，获取字符串，通过换行符分割，获取每个命令的路径
// const results = readFileSync('results.json', 'utf8');
// const lines = results.split('\r\n');
// const commands = lines.filter(line => line.includes('Command') && !line.includes('�'));
// console.log(commands);

// // 遍历每个命令，执行并获取结果
// commands.forEach(command => {
//   const cmd = command.trim()
//   exec(`reg query ${cmd} /s`, (error, stdout, stderr) => {
//     if (error) {
//       console.error(`执行 ${cmd} 命令时出错: ${error.message}`);
//       return;
//     }
//     if (stderr) {
//       console.error(`${cmd} 命令 stderr: ${stderr}`);
//       return;
//     }
//     // 追加写入到command-result.json文件
//     writeFileSync('command-result.json', `${cmd}\n${stdout}\n\n`, { flag: 'a' });
//   });
// });

// 读取command-result.json文件，获取字符串，通过换行符分割，获取每个命令的路径
const commandResults = readFileSync('command-result.json', 'utf8');
const commandLines = commandResults.split('\r\n');
const commandPaths = commandLines.filter(line => line.includes('.exe'));
console.log(commandPaths);
// 去重，写入command-paths.json文件
const uniquePaths = [...new Set(commandPaths)];
writeFileSync('command-paths.json', JSON.stringify(uniquePaths, null, 2), { flag: 'w' });