declare function start(type?: 'prevent-app-suspension' | 'prevent-display-sleep'): void;
declare function stop(type?: 'prevent-app-suspension' | 'prevent-display-sleep'): void;
declare const _default: {
    start: typeof start;
    stop: typeof stop;
};
export default _default;
