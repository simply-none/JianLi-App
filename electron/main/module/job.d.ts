export declare function createJob({ win, time, onTick, isTick, msgName, type, }: {
    win: any;
    time?: number;
    onTick?: () => void;
    isTick?: boolean;
    msgName?: string;
    type?: string;
}): void;
export declare function stopJob(type?: string): void;
export declare function initJob(): void;
export declare function startJobFn({ type, gap, auto }: {
    type: 'string';
    gap: number | string;
    auto: boolean;
}): Promise<void>;
declare const _default: {
    createJob: typeof createJob;
    stopJob: typeof stopJob;
};
export default _default;
