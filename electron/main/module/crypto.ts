import { ipcMain } from "electron";
import crypto from "node:crypto";
import { query, upsert } from "./newSql.ts";
import { tableName } from "./store.ts";
import colors from "colors";

// 使用nodejs原生crypto模块进行加密，解密
const originPassPhrase = "mysecretpassphrase afjaoewLKFWAJFOAWJF";

// 生成RSA密钥对
export async function generateRSAKeyPair(passphrase: string = originPassPhrase): Promise<{
  publicKey: string;
  privateKey: string;
}> {
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
  try {
    // 使用高性能 newSql 模块落库（替代旧 sql.ts），主键 key 唯一
    await upsert({
      tableName,
      data: {
        key: "RSAKey",
        value: JSON.stringify({ publicKey, privateKey }),
      },
      config: {
        primaryKey: "key",
      },
    });
  } catch (err) {
    console.log(err, "------err");
  }

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

// 去除密文外层可能存在的 JSON 引号（历史数据曾以 JSON 字符串形式存储 base64）
function stripJsonQuotes(text: string): string {
  const t = (text || "").trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  }
  return t;
}

// 统一的私钥解密入口：返回结构化结果，便于上层区分「解密失败」与「密码不匹配」
function safePrivateDecrypt(
  encryptedText: string,
  privateKeyPem: string,
  passphrase: string = originPassPhrase
): { ok: boolean; decrypted?: string } {
  try {
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        passphrase: passphrase || originPassPhrase,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(stripJsonQuotes(encryptedText), "base64")
    );
    return { ok: true, decrypted: decrypted.toString("utf8") };
  } catch (error) {
    // RSA 私钥解密可能因密文长度超过模长 / 密钥不匹配 / 非合法密文而抛异常，
    // 绝不能让异常冒泡导致主进程崩溃（此前「开始工作」输密码即卡死）。
    console.error("[crypto] 私钥解密失败（密文非法或密钥不匹配）:", error);
    return { ok: false };
  }
}

// 解密（兼容旧调用，失败返回空串）
export function decrypt(
  encryptedText: string,
  key: string,
  passphrase: string = originPassPhrase
): string {
  const res = safePrivateDecrypt(encryptedText, key, passphrase);
  return res.ok ? (res.decrypted as string) : "";
}

// 应用启动时确保 RSAKey 存在：仅当 DB 中确实没有时才生成一次并落库。
// 绝不在 encrypt/decrypt/compare 的 err 分支重新生成，否则会覆盖有效密钥对，
// 导致已存密文与新私钥不匹配（密码永久校验失败）。
export function ensureRSAKey() {
  // 使用高性能 newSql 模块读取（替代旧 sql.ts 的 queryByConditions）
  query({ tableName, conditions: { key: "RSAKey" } })
    .then((data) => {
      if (!data || data.length === 0) {
        // 仅首次（确实无密钥）生成，generateRSAKeyPair 内部会 upsert 落库
        generateRSAKeyPair().catch((err) =>
          console.error("[crypto] 生成 RSAKey 失败:", err)
        );
        console.log("[crypto] 首次初始化 RSAKey 已生成并落库");
      } else {
        console.log("[crypto] RSAKey 已存在，复用，不覆盖");
      }
    })
    .catch((err) => {
      // 读不到密钥对：安全生成一次（generateRSAKeyPair 内部 upsert 不覆盖已有行）
      generateRSAKeyPair().catch((e) =>
        console.error("[crypto] 生成 RSAKey 失败:", e)
      );
      console.error("[crypto] ensureRSAKey 读取异常，尝试生成:", err);
    });
}

export function initCrypto() {
  // 启动时确保密钥对存在（无则生成一次），之后各通道只读不生成
  ensureRSAKey();

  ipcMain.on("encrypt-pwd", (event, arg: ObjectType) => {
    const { text } = arg;
    // 使用高性能 newSql 模块读取（替代旧 sql.ts 的 queryByConditions）
    query({ tableName, conditions: { key: "RSAKey" } })
      .then((data) => {
        try {
          if (!data || data.length === 0) {
            // 读不到密钥对：返回空串（安全失败），绝不重新生成覆盖有效密钥
            console.error("[crypto] encrypt-pwd 读取 RSAKey 失败，返回空密文（不覆盖密钥）");
            event.returnValue = "";
            return;
          }
          const RSAKey = JSON.parse(data[0].value);
          const { publicKey } = RSAKey;
          event.returnValue = encrypt(text, publicKey);
        } catch (cbError) {
          console.error("[crypto] encrypt-pwd 处理失败:", cbError);
          event.returnValue = "";
        }
      })
      .catch((err) => {
        console.error("[crypto] encrypt-pwd 查询异常:", err);
        event.returnValue = "";
      });
  });

  ipcMain.on("decrypt-pwd", (event, arg: ObjectType) => {
    const { text, passphrase } = arg;
    // 使用高性能 newSql 模块读取（替代旧 sql.ts 的 queryByConditions）
    query({ tableName, conditions: { key: "RSAKey" } })
      .then((data) => {
        try {
          if (!data || data.length === 0) {
            console.error("[crypto] decrypt-pwd 读取 RSAKey 失败，返回 { ok: false }（不覆盖密钥）");
            event.returnValue = { ok: false };
            return;
          }
          const RSAKey = JSON.parse(data[0].value);
          const { privateKey } = RSAKey;
          // 返回结构化结果，便于渲染端区分「解密失败」与「密码不匹配」
          event.returnValue = safePrivateDecrypt(text, privateKey, passphrase);
        } catch (cbError) {
          // 异步内的异常必须兜底，否则 returnValue 永不设置 → 渲染端 sendSync 阻塞卡死
          console.error("[crypto] decrypt-pwd 处理失败:", cbError);
          event.returnValue = { ok: false };
        }
      })
      .catch((err) => {
        console.error("[crypto] decrypt-pwd 查询异常:", err);
        event.returnValue = { ok: false };
      });
  });

  // 比较密码是否相同
  ipcMain.on("compare-pwd", (event, arg: ObjectType) => {
    const { text, encryptText, passphrase } = arg;
    // 使用高性能 newSql 模块读取（替代旧 sql.ts 的 queryByConditions）
    query({ tableName, conditions: { key: "RSAKey" } })
      .then((data) => {
        try {
          if (!data || data.length === 0) {
            // 读不到密钥对：安全返回 false（不覆盖），让上层走密保重置流程
            console.error("[crypto] compare-pwd 读取 RSAKey 失败，返回 false（不覆盖密钥）");
            event.returnValue = false;
            return;
          }
          const RSAKey = JSON.parse(data[0].value);
          const { privateKey } = RSAKey;
          const res = safePrivateDecrypt(encryptText, privateKey, passphrase);
          event.returnValue = res.ok && res.decrypted === text;
        } catch (cbError) {
          console.error("[crypto] compare-pwd 处理失败:", cbError);
          event.returnValue = false;
        }
      })
      .catch((err) => {
        console.error("[crypto] compare-pwd 查询异常:", err);
        event.returnValue = false;
      });
  });
}

// 使用示例
async function init() {
  const { publicKey, privateKey } = await generateRSAKeyPair();
  const message = "Hello, world!";
  console.log("Original message:", message);

  const encryptedMessage = encrypt(message, publicKey);
  console.log("Encrypted message:", encryptedMessage);

  const decryptedMessage = decrypt(encryptedMessage, privateKey);

  console.log("Decrypted message:", decryptedMessage);
}
