import useGlobalSetting from "@/store/useGlobalSetting";
import { storeToRefs } from "pinia";

const { globalFontOpsC } = storeToRefs(useGlobalSetting())
// 获取系统安装的所有字体
export async function getSystemFonts() {
  if ("queryLocalFonts" in window) {
    try {
      let  availableFonts: any[] = await (window as any).queryLocalFonts();
      if (!availableFonts.length) {
        return [...globalFontOpsC.value];
      }
      availableFonts = availableFonts.map(item => {
        return {
          label: item.fullName,
          value: item.family,
        }
      });
      // 去重重复项 通过value去重
      const uniqueFonts = availableFonts.filter((item, index, array) => {
        return array.findIndex(t => t.value === item.value) === index;
      });
      return [...globalFontOpsC.value, ...uniqueFonts];
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    return Promise.reject("浏览器版本太低 or 网站不安全");
  }
}
