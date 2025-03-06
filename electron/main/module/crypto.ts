import { ipcMain } from "electron";
import crypto from "node:crypto";
import ElectronStore from "electron-store";
// 使用nodejs原生crypto模块进行加密，解密
let store = new ElectronStore();

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
  store.set("RSAKey", { publicKey, privateKey });

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
}

export function initCrypto() {
  ipcMain.on("encrypt-pwd", (event, arg: ObjectType) => {
    const { text } = arg;
    const RSAKey: any = store.get("RSAKey");
    const { publicKey } = RSAKey ? RSAKey : generateRSAKeyPair();
    const encryptedText = encrypt(text, publicKey);
    event.returnValue = encryptedText;
  });

  ipcMain.on("decrypt-pwd", (event, arg: ObjectType) => {
    const { text, passphrase } = arg;
    const RSAKey: any = store.get("RSAKey");
    const { privateKey } = RSAKey ? RSAKey : generateRSAKeyPair();
    const decryptedText = decrypt(text, privateKey, passphrase);
    event.returnValue = decryptedText;
  });

  // 比较密码是否相同
  ipcMain.on("compare-pwd", (event, arg: ObjectType) => {
    try {
      const { text, encryptText, passphrase } = arg;
      console.log(text, '------', encryptText, '------', passphrase, '------passphrase')
      const RSAKey: any = store.get("RSAKey");
      const { privateKey } = RSAKey ? RSAKey : generateRSAKeyPair();
      console.log(privateKey, '------privateKey')
      const decryptedText = decrypt(encryptText, privateKey, passphrase);
      console.log(decryptedText, '------decryptedText')
      event.returnValue = decryptedText === text;
    } catch (error) {
      console.log(error)
      event.returnValue = false;
    }
  })
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
