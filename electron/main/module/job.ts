import { ipcMain } from "electron";
import { CronJob } from "cron";
import momemt from "moment";
import { win, hideApp, focusAppToTop } from "./mainWindow.ts";
import { createOtherWindow, closeOtherWindow, hideOtherWindow, showOtherWindow } from "./newWindow.ts";
import { queryByConditions, upsertData } from "../utils/sql.ts";
import { myDb } from "./sql.ts";
import { tableName } from "./store.ts";

let job = {
  // 工作/休息定时器
  workOrRest: null,
};
// 停止job
let sJob = {

}

export function createJob({
  win,
  time = 5 * 60 * 1000,
  onTick = () => {},
  isTick = true,
  msgName = "tip-job",
  type = 'workOrRest',
}) {
  if (job[type]) {
    stopJob(type);
  }
  let jobTime = time;
  if (jobTime < 5 * 60 * 60) jobTime = 5 * 60 * 60;

  const currentSecondTime = new Date().getSeconds();
  const currentMinuteTime = new Date().getMinutes();
  console.log(currentSecondTime, jobTime);
  const nextRunTime = momemt().add(jobTime, "milliseconds").toDate();

  job[type] = new CronJob(
    nextRunTime, // cronTime
    function () {
      onTick();
      if (!isTick) return;
      win?.webContents.send(msgName, Date.now());
    }, // onTick
    null, // onComplete
    true, // start
    "America/Los_Angeles" // timeZone
  );
}

export function stopJob(type?: string) {
  if (!type) {
    // 清除所有的job
    for (const key in job) {
      if (Object.prototype.hasOwnProperty.call(job, key)) {
        stopJob(key);
      }
    }
  } else {
    job[type]?.stop();
    job[type] = null;
    delete job[type];
  }
}

export function initJob() {
  ipcMain.on("start-work", (e, workTimeGap: number) => {
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

  ipcMain.on("start-rest", (e, restTimeGap: number) => {
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
  ipcMain.on("start-screen-saver", (e, restTimeGap?: number) => {
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
  ipcMain.on("start-job", (e, { type, gap, auto }: { type: 'string', gap: number | string, auto: boolean }) => {
    startJobFn({ type, gap, auto });
  });

  // 停止job
  ipcMain.on("stop-job", (e, {type}: { type?: string }) => {
    console.log(type, 'stop-job');
    sJob[type] = Date.now()
    stopJob(type);
  });
}

export async function startJobFn({ type, gap, auto }: { type: 'string', gap: number | string, auto: boolean }) {
  if (!auto) {
    sJob[type] = Date.now()
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
        } else {
          win?.webContents.send("job-start-tip", {
            type,
            time: Date.now(),
            gap: isNaN ? 1000 * 60 * 60 : Number(gap),
          });
        }
      },
    });
  }
  let sJobType = sJob[type]
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
            } else {
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
              })
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
