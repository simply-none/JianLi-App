import { ElMessage, ElMessageBox } from "element-plus";
import { ref } from "vue";

export const open = (
  msg: string,
  delay: number = 3,
  confirmFn?: () => void,
  cancelFn?: () => void
) => {
  const delayTime = ref(delay);
  let timer = ref<NodeJS.Timeout | string | number | undefined>();
  ElMessageBox.confirm(msg, {
    confirmButtonText: "确认",
    cancelButtonText: "取消",
    type: "warning",
    beforeClose: (action: any, instance: any, done: any) => {
      if (action === "confirm") {
        instance.confirmButtonLoading = true;
        delayTime.value--;
        instance.confirmButtonText = `确认(${delayTime.value})`;
        timer.value = setInterval(() => {
          if (delayTime.value === 0) {
            clearInterval(timer.value);
            instance.confirmButtonLoading = false;
            done();
            return;
          }
          delayTime.value--;
          instance.confirmButtonText = `确认(${delayTime.value})`;
        }, 1000);
      } else {
        clearInterval(timer.value);
        done();
      }
    },
  })
    .then(() => {
      confirmFn && confirmFn();
    })
    .catch(() => {
      cancelFn && cancelFn();
    });
};

export default {
  open,
};
