import { ipcMain } from "electron";
import { CronJob } from "cron";
import momemt from "moment";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import { createOtherWindow } from "./newWindow.ts";
import { queryByConditions, upsertData } from "../utils/sql.ts";
import { myDb } from "./sql.ts";
import { tableName } from "./store.ts";
let job = {
    // 工作/休息定时器
    workOrRest: null,
};
// 停止job
let sJob = {};
export function createJob({ win, time = 5 * 60 * 1000, onTick = () => { }, isTick = true, msgName = "tip-job", type = 'workOrRest', }) {
    if (job[type]) {
        stopJob(type);
    }
    let jobTime = time;
    if (jobTime < 5 * 1000)
        jobTime = 5 * 1000;
    const currentSecondTime = new Date().getSeconds();
    const currentMinuteTime = new Date().getMinutes();
    console.log(currentSecondTime, jobTime);
    const nextRunTime = momemt().add(jobTime, "milliseconds").toDate();
    try {
        job[type] = new CronJob(nextRunTime, // cronTime
        function () {
            onTick();
            if (!isTick)
                return;
            win?.webContents.send(msgName, Date.now() + 1000);
        }, // onTick
        null, // onComplete
        true, // start
        'Asia/Shanghai' // timeZone
        );
    }
    catch (error) {
        let truthMsg = error.message || error.toString();
        if (truthMsg.includes("Date in past")) {
            // 如果是过去的时间，则直接执行
            onTick();
            if (!isTick)
                return;
            win?.webContents.send(msgName, Date.now() + 1000);
        }
        else {
            throw error;
        }
    }
}
export function stopJob(type) {
    if (!type) {
        // 清除所有的job
        for (const key in job) {
            if (Object.prototype.hasOwnProperty.call(job, key)) {
                stopJob(key);
            }
        }
    }
    else {
        job[type]?.stop();
        job[type] = null;
        delete job[type];
    }
}
// 定时提醒任务管理
let reminderJobs = {};
// 根据定点提醒生成 cron 表达式
function buildReminderCronExpr(reminder) {
    const [hour, minute] = (reminder.time || '09:00').split(':').map(Number);
    if (reminder.repeat === 'hourly') {
        // 每小时的第 X 分钟
        const m = reminder.minute ?? minute;
        return `${m} * * * *`;
    }
    if (reminder.repeat === 'daily') {
        return `${minute} ${hour} * * *`;
    }
    if (reminder.repeat === 'weekly') {
        const days = (reminder.weekDays || []).join(',');
        return `${minute} ${hour} * * ${days || '*'}`;
    }
    if (reminder.repeat === 'monthly') {
        // 每月 X 号 HH:mm
        const dom = reminder.dayOfMonth || 1;
        return `${minute} ${hour} ${dom} * *`;
    }
    if (reminder.repeat === 'yearly') {
        // 每年 X 月 Y 日 HH:mm
        const mon = reminder.month || 1;
        const dom = reminder.dayOfMonth || 1;
        return `${minute} ${hour} ${dom} ${mon} *`;
    }
    // 仅一次：具体日期
    const parts = (reminder.date || '').split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN))
        return '';
    const [y, m, d] = parts;
    return `${minute} ${hour} ${d} ${m} *`;
}
// 到点触发提醒
function triggerReminder(reminder) {
    win?.webContents.send('reminder-trigger', {
        ...reminder,
        triggerTime: Date.now(),
    });
}
// 调度单条提醒
function scheduleReminder(reminder) {
    if (reminder.mode === 'interval') {
        // 周期提醒：间隔触发后重新调度下一次
        const gap = Number(reminder.interval) * Number(reminder.unit);
        if (isNaN(gap) || gap <= 0)
            return;
        const job = new CronJob(new Date(Date.now() + gap), () => {
            triggerReminder(reminder);
            scheduleReminder(reminder);
        }, null, true, 'Asia/Shanghai');
        reminderJobs[reminder.id] = job;
    }
    else {
        // 定点提醒：cron 表达式
        const cronExpr = buildReminderCronExpr(reminder);
        if (!cronExpr)
            return;
        try {
            const job = new CronJob(cronExpr, () => triggerReminder(reminder), null, true, 'Asia/Shanghai');
            reminderJobs[reminder.id] = job;
        }
        catch (error) {
            console.error('创建定点提醒失败:', reminder, error);
        }
    }
}
// 清除所有提醒任务
function clearReminderJobs() {
    for (const id in reminderJobs) {
        reminderJobs[id]?.stop();
        delete reminderJobs[id];
    }
}
// 全量应用提醒配置
function applyReminders(reminders) {
    clearReminderJobs();
    (reminders || []).forEach(reminder => {
        if (!reminder.enabled)
            return;
        scheduleReminder(reminder);
    });
}
// 应用启动时从数据库恢复定时提醒
function restoreReminders() {
    queryByConditions({
        db: myDb.db,
        tableName: tableName,
        conditions: { key: 'reminders' },
        callback: (err, data) => {
            if (err || !data || data.length === 0)
                return;
            try {
                const reminders = JSON.parse(data[0].value);
                applyReminders(reminders);
            }
            catch (e) {
                console.error('恢复定时提醒失败:', e);
            }
        },
    });
}
export function initJob() {
    // 启动时恢复已启用的定时提醒
    restoreReminders();
    // 同步定时提醒配置
    ipcMain.on("update-reminders", (e, reminders) => {
        applyReminders(reminders);
    });
    ipcMain.on("start-work", (e, workTimeGap) => {
        hideApp();
        createJob({
            win,
            msgName: "close-work",
            time: workTimeGap,
            onTick: () => {
                // 打开第二窗口
                // createOtherWindow('small')
            },
        });
    });
    ipcMain.on("start-rest", (e, restTimeGap) => {
        focusAppToTop();
        createJob({
            win,
            msgName: "close-rest",
            time: restTimeGap,
            onTick: () => {
                hideApp();
                // closeOtherWindow('small')
            },
        });
    });
    // 开启屏保模式
    ipcMain.on("start-screen-saver", (e, restTimeGap) => {
        focusAppToTop();
        createJob({
            win,
            msgName: "close-screen-saver",
            time: restTimeGap || 1000 * 60 * 60 * 24 * 30,
            onTick: () => {
                hideApp();
                // closeOtherWindow('small')
            },
        });
    });
    // 开启job
    ipcMain.on("start-job", (e, { type, gap, auto }) => {
        startJobFn({ type, gap, auto });
    });
    // 停止job
    ipcMain.on("stop-job", (e, { type }) => {
        console.log(type, 'stop-job');
        sJob[type] = Date.now();
        stopJob(type);
    });
}
export async function startJobFn({ type, gap, auto }) {
    if (!auto) {
        sJob[type] = Date.now();
        let isNaN = Number.isNaN(Number(gap));
        // 插入数据
        await upsertData({
            db: myDb.db,
            tableName: tableName,
            data: {
                key: 'job-tip:' + type,
                value: JSON.stringify({
                    type,
                    time: Date.now(),
                    gap: isNaN ? 1000 * 60 * 60 : Number(gap),
                    endTipTime: Date.now() + (isNaN ? 1000 * 60 * 60 : Number(gap)),
                })
            },
            config: {
                primaryKey: "key",
            },
            callback: async (err, result) => {
                if (err) {
                    console.log(err, "err");
                }
                else {
                    win?.webContents.send("job-start-tip", {
                        type,
                        time: Date.now(),
                        gap: isNaN ? 1000 * 60 * 60 : Number(gap),
                    });
                }
            },
        });
    }
    let sJobType = sJob[type];
    let isNaN = Number.isNaN(Number(gap));
    createJob({
        win,
        type,
        msgName: "start-" + type,
        time: isNaN ? 1000 * 60 * 60 : Number(gap),
        isTick: false,
        onTick: async () => {
            if (sJobType != sJob[type]) {
                return;
            }
            // 插入数据
            await upsertData({
                db: myDb.db,
                tableName: tableName,
                data: {
                    key: 'job-tip:' + type,
                    value: JSON.stringify({
                        type,
                        time: Date.now(),
                        gap: isNaN ? 1000 * 60 * 60 : Number(gap),
                        endTipTime: Date.now() + (isNaN ? 1000 * 60 * 60 : Number(gap)),
                    })
                },
                config: {
                    primaryKey: "key",
                },
                callback: async (err, result) => {
                    if (err) {
                        console.log(err, "err");
                    }
                    else {
                        // 发送提醒
                        createOtherWindow("jobTipWindow", {
                            resizable: true,
                            frame: false,
                            width: 200,
                            height: 100,
                            // center: true,
                            transparent: true,
                            mouseEvents: true,
                            fullscreenable: false,
                            x: 100,
                            y: 100,
                        });
                        win?.webContents.send("job-end-tip", {
                            type,
                            time: Date.now(),
                            gap: isNaN ? 1000 * 60 * 60 : Number(gap),
                        });
                    }
                },
            });
            // 新一轮计时
            startJobFn({ type, gap, auto: true });
        },
    });
}
export default {
    createJob,
    stopJob,
};
