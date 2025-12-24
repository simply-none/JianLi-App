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

  // 密保问题，总共有3个问题
  const pwdQuestionList = ref();
  const pwdQuestionListC = computed(() => pwdQuestionList.value);

  function setPwdQuestionList(value: ObjectType[] = []) {
    // 先加密
    console.log(JSON.stringify(value))
    try {
      const newValue = value.map((item) => {
        console.log(item.answer)
        const answer = sendSync("encrypt-pwd", { text: item.answer });
        return {
          question: item.question,
          answer: answer, 
        }
      });
      // console.log(JSON.stringify(newValue), 'newValue')
      pwdQuestionList.value = [...toRaw(pwdQuestionList.value), ...newValue];
      // console.log(JSON.stringify(pwdQuestionList.value));
      // console.log(toRaw(pwdQuestionList.value), 'toRaw(pwdQuestionList.value)')
      setStore("pwdQuestionList", pwdQuestionList);
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
    setPwdQuestionList,
    // 其他
    $reset,
  };
});
