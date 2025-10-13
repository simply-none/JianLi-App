import { ipcMain, app } from "electron";
import colors from 'colors'
import { getFonts2 } from 'font-list'

export async function initSys() {
  let fonts: ObjectType = await getFonts2()
  fonts = fonts.map((item: ObjectType) => {
    return {
      label: item.familyName,
      value: item.familyName,
    }
  })

  // 获取表数据，参数为表名，以及查询条件
  ipcMain.handle("get-fonts", async (event) => {
    return new Promise((resolve) => {
      resolve(fonts)
    });
  });
}
