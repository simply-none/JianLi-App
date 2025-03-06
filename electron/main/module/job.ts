import { ipcMain } from "electron";
import { CronJob } from "cron";
import momemt from "moment";

let job;

export function createJob({
  win,
  time = 5 * 60 * 1000,
  onTick = () => {},
  msgName = "tip-job",
}) {
  if (job) {
    job.stop();
    job = null;
  }
  let jobTime = time;
  if (jobTime < 5 * 60 * 60) jobTime = 5 * 60 * 60;

  const currentSecondTime = new Date().getSeconds();
  const currentMinuteTime = new Date().getMinutes();
  console.log(currentSecondTime, jobTime);
  const nextRunTime = momemt().add(jobTime, "milliseconds").toDate();

  job = new CronJob(
    nextRunTime, // cronTime
    function () {
      onTick();
      win?.webContents.send(msgName, Date.now());
    }, // onTick
    null, // onComplete
    true, // start
    "America/Los_Angeles" // timeZone
  );
}

export function stopJob() {
  job.stop();
  job = null;
}

export function initJob({ win, hideApp, focusAppToTop }) {
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
}

export default {
  createJob,
  stopJob,
};
