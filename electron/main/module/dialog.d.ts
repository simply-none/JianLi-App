import { BrowserWindow } from "electron";
interface FileSaveObjType {
    content: any;
    path: string;
    name: string;
    tempSplit: string;
    chunkLength: number;
    currentChunkIndex: number;
}
export type CopyFolderType = {
    source: string;
    target: string;
    ignore?: string[];
    include?: string[];
    ignoreSuffix?: string[];
    includeSuffix?: string[];
    preserveTimestamps?: boolean;
    force?: boolean;
    recursive?: boolean;
};
export declare function getFilePath({ openFile, openDirectory, multiSelections, type, }: {
    openFile?: boolean;
    openDirectory?: boolean;
    multiSelections?: boolean;
    type?: String | String[];
}): string[];
export declare function saveFile({ path, name, tempSplit, content, chunkLength, currentChunkIndex, }: FileSaveObjType): Promise<string>;
export declare function copyFolder({ source, target, ignore, include, ignoreSuffix, includeSuffix, preserveTimestamps, force, recursive, }: CopyFolderType, win: BrowserWindow): void;
export declare function exportDataToJson(data: any, path: string): any;
export declare function openFileInAssetsManager(filePath: string): void;
export declare function initFile(): void;
export {};
