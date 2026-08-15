export declare function generateRSAKeyPair(passphrase?: string): {
    publicKey: string;
    privateKey: string;
};
export declare function encrypt(text: string, key: string): string;
export declare function decrypt(encryptedText: string, key: string, passphrase?: string): string;
export declare function initCrypto(): void;
