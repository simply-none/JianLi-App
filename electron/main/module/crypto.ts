import { ipcMain } from "electron";
import crypto from "node:crypto";
import { queryByConditions, upsertData } from "../utils/sql.ts";
import { tableName } from "./store.ts";
import { myDb } from "./sql.ts";
import colors from "colors";

// 使用nodejs原生crypto模块进行加密，解密
const originPassPhrase = "mysecretpassphrase afjaoewLKFWAJFOAWJF";

// 生成RSA密钥对
export function generateRSAKeyPair(passphrase: string = originPassPhrase): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: passphrase || originPassPhrase, // 可选的密码短语
    },
  });
  upsertData({
    db: myDb.db,
    tableName,
    data: {
      key: "RSAKey",
      value: JSON.stringify({ publicKey, privateKey }),
    },
    config: {
      primaryKey: "key",
    },
    callback: (err, result) => {
      if (err) {
        console.log(err, "------err");
      }
    },
  });

  return { publicKey, privateKey };
}

// 加密
export function encrypt(text: string, key: string): string {
  const encrypted = crypto.publicEncrypt(
    {
      key,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(text)
  );
  return encrypted.toString("base64");
}

// 解密
export function decrypt(
  encryptedText: string,
  key: string,
  passphrase: string = originPassPhrase
): string {
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key,
        passphrase: passphrase || originPassPhrase,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(encryptedText, "base64")
    );
    return decrypted.toString("utf8");
  } catch (error) {
    // RSA 私钥解密可能因密文长度超过模长 / 非合法密文而抛异常，
    // 绝不能让异常冒泡导致主进程崩溃（此前「开始工作」输密码即卡死）。
    console.error("[crypto.decrypt] 解密失败（密文可能非法或过长）:", error);
    return "";
  }
}

// 应用启动时确保 RSAKey 存在：仅当 DB 中确实没有时才生成一次并落库。
// 绝不在 encrypt/decrypt/compare 的 err 分支重新生成，否则会覆盖有效密钥对，
// 导致已存密文与新私钥不匹配（密码永久校验失败）。
export function ensureRSAKey() {
  queryByConditions({
    db: myDb.db,
    tableName,
    conditions: { key: "RSAKey" },
    callback: (err, data) => {
      if (err || !data || data.length === 0) {
        // 仅首次（确实无密钥）生成，generateRSAKeyPair 内部会 upsert 落库
        generateRSAKeyPair();
        console.log("[crypto] 首次初始化 RSAKey 已生成并落库");
      } else {
        console.log("[crypto] RSAKey 已存在，复用，不覆盖");
      }
    },
  });
}

export function initCrypto() {
  // 启动时确保密钥对存在（无则生成一次），之后各通道只读不生成
  ensureRSAKey();

  ipcMain.on("encrypt-pwd", (event, arg: ObjectType) => {
    const { text } = arg;
    queryByConditions({
      db: myDb.db,
      tableName,
      conditions: { key: "RSAKey" },
      callback: (err, data) => {
        try {
          let RSAKey: any = null;
          if (err || !data || data.length === 0) {
            // 读不到密钥对：返回空串（安全失败），绝不重新生成覆盖有效密钥
            console.error("[crypto] encrypt-pwd 读取 RSAKey 失败，返回空密文（不覆盖密钥）");
            event.returnValue = "";
            return;
          }
          RSAKey = JSON.parse(data[0].value);
          const { publicKey } = RSAKey;
          const encryptedText = encrypt(text, publicKey);
          event.returnValue = encryptedText;
        } catch (cbError) {
          console.error("[crypto] encrypt-pwd 回调失败:", cbError);
          event.returnValue = "";
        }
      },
    });
  });

  ipcMain.on("decrypt-pwd", (event, arg: ObjectType) => {
    const { text, passphrase } = arg;
    queryByConditions({
      db: myDb.db,
      tableName,
      conditions: { key: "RSAKey" },
      callback: (err, data) => {
        try {
          if (err || !data || data.length === 0) {
            console.error("[crypto] decrypt-pwd 读取 RSAKey 失败，返回空（不覆盖密钥）");
            event.returnValue = "";
            return;
          }
          const RSAKey = JSON.parse(data[0].value);
          const { privateKey } = RSAKey;
          const decryptedText = decrypt(text, privateKey, passphrase);
          event.returnValue = decryptedText;
        } catch (cbError) {
          // 异步回调内的异常外层无法捕获，必须在此兜底，
          // 否则 returnValue 永不设置 → 渲染端 sendSync 阻塞卡死
          console.error("[crypto] decrypt-pwd 回调失败:", cbError);
          event.returnValue = "";
        }
      },
    });
  });

  // 比较密码是否相同
  ipcMain.on("compare-pwd", (event, arg: ObjectType) => {
    const { text, encryptText, passphrase } = arg;
    queryByConditions({
      db: myDb.db,
      tableName,
      conditions: { key: "RSAKey" },
      callback: (err, data) => {
        try {
          if (err || !data || data.length === 0) {
            // 读不到密钥对：安全返回 false（不覆盖），让上层走密保重置流程
            console.error("[crypto] compare-pwd 读取 RSAKey 失败，返回 false（不覆盖密钥）");
            event.returnValue = false;
            return;
          }
          const RSAKey = JSON.parse(data[0].value);
          const { privateKey } = RSAKey;
          const decryptedText = decrypt(encryptText, privateKey, passphrase);
          event.returnValue = decryptedText === text;
        } catch (cbError) {
          // 异步回调内的异常外层 try 捕获不到，必须在此兜底
          console.error("[crypto] compare-pwd 回调失败:", cbError);
          event.returnValue = false;
        }
      },
    });
  });
}

// 使用示例
function init() {
  const { publicKey, privateKey } = generateRSAKeyPair();
  const message = "Hello, world!";
  console.log("Original message:", message);

  const encryptedMessage = encrypt(message, publicKey);
  console.log("Encrypted message:", encryptedMessage);

  const decryptedMessage = decrypt(encryptedMessage, privateKey);

  console.log("Decrypted message:", decryptedMessage);
}
