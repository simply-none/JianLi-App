import { computed, onMounted, ref, toRaw } from "vue";
import { defineStore, storeToRefs } from "pinia";
import { getStore, sendSync, setStore } from "../utils/common";
import { initPiniaStatus, type defaultField } from "@/utils/store";
import { ElMessage } from "element-plus";

export default defineStore("safety-protection", () => {
  // 密码
  const password = ref();
  const passwordC = computed(() => password.value);

  function setPassword(value: string) {
    const encryText = sendSync("encrypt-pwd", { text: value });
    password.value = encryText;
    setStore("password", encryText);
  }

  // 新旧密码验证是否相同,给下面的函数名称 重新语义化命名
  function isPwdSame(value: string, oldValue?: string) {
    console.log(passwordC.value, 'passwordC.value')
    const encryText = sendSync("compare-pwd", {
      text: value,
      encryptText: oldValue || passwordC.value,
    });
    return encryText;
  }

  // 检测已存储的密码密文是否可被当前 RSAKey 解密成功。
  // 用于区分「解密失败（密钥不匹配/密文损坏）」与「密码输入错误」，
  // 解密失败时应引导用户直接重置密码，而非困在密保流程。
  function isStoredPasswordDecryptable(): boolean {
    // 未设置密码时无需解密，视为可解密
    if (!passwordC.value) return true;
    try {
      const res = sendSync("decrypt-pwd", { text: passwordC.value });
      return !!(res && res.ok);
    } catch (error) {
      // 接口异常时保守按「可解密」处理，避免误触发重置流程
      console.error("[safety-protection] 检测密码可解密性失败:", error);
      return true;
    }
  }

  // 密保问题，总共有3个问题
  const pwdQuestionList = ref();
  const pwdQuestionListC = computed(() => pwdQuestionList.value);

  function setPwdQuestionList(value: ObjectType[] = []) {
    // 先加密
    try {
      const newValue = value.map((item) => {
        const answer = sendSync("encrypt-pwd", { text: item.answer });
        return {
          question: item.question,
          answer: answer,
        }
      });
      // 整体覆盖（修改原有项 / 新增项都以传入的完整列表替换存储，避免追加造成重复）
      pwdQuestionList.value = toRaw(newValue);
      setStore("pwdQuestionList", pwdQuestionList.value);
    } catch (error) {
      ElMessage.error(error + '');
    }
  }

  // pinia状态初始化
  function init() {
    // 布尔值变量
    const boolVars: defaultField[] = [];
    // 数字值变量
    const numberVars: defaultField[] = [];
    // 字符串值变量
    const stringVars: defaultField[] = [
      { field: "password", default: "", map: password },
    ];
    // 颜色值变量
    const colorVars: defaultField[] = [];
    // 字体值变量
    const fontVars: defaultField[] = [];

    // 对象值变量
    const objectVars: defaultField[] = [
      {
        field: "pwdQuestionList",
        default: [],
        map: pwdQuestionList, 
      }
    ];

    // 所有的变量集合
    const allVars: defaultField[] = [
      ...boolVars,
      ...numberVars,
      ...stringVars,
      ...colorVars,
      ...fontVars,
      ...objectVars,
    ];

    // 默认值赋值
    initPiniaStatus(allVars);
  }

  function $reset() {
    init();
  }

  onMounted(() => {
    init();
  });

  return {
    // 变量
    password,
    passwordC,
    pwdQuestionList,
    pwdQuestionListC,
    // 方法
    setPassword,
    isPwdSame,
    isStoredPasswordDecryptable,
    setPwdQuestionList,
    // 其他
    $reset,
  };
});
