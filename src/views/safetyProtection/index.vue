<template>
  <el-form class="safetyProtection-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">密码设置</div>
      </template>
    </el-form-item>
    <!-- 原密码 -->
    <el-form-item label="原密码" style="width: 100%;">
      <!-- 使用<div class="password">元素展示 -->
      <div class="password">
        {{ passwordC }}
      </div>
    </el-form-item>
    <!-- 校验密码是否相同 -->
    <el-form-item label="密码校验" style="width: 100%;">
      <el-input v-model="verifyPassword" placeholder="请输入" style="width: 100%">
        <template #append>
          <el-button @click="checkPassword">
            校验
          </el-button>
        </template>
      </el-input>
    </el-form-item>
    <!-- 设置密码 -->
    <el-form-item label="设置密码" style="width: 100%;" v-if="ischeckPassword">
      <!-- 新密码 -->
      <!-- 需要一边输入一边进行密码强度校验，改写上述注释内容 -->
      <el-input v-model="newPassword" placeholder="请输入" style="width: 100%" @keyup.enter="updatePwd">
        <template #append>
          <el-button @click="updatePwd">
            确定
          </el-button>
        </template>
      </el-input>
      <!-- 校验密码强度等级 -->
      <el-progress :percentage="checkPasswordStrength(newPassword) * 100" striped status="success"></el-progress>
    </el-form-item>
    <!-- 确认密码 -->
    <el-form-item label="确认密码" style="width: 100%;" v-if="ischeckPassword">
      <el-input v-model="confirmPassword" placeholder="请输入" style="width: 100%" @keyup.enter="updatePwd">
        <template #append>
          <el-button @click="updatePwd">
            确定
          </el-button>
        </template>
      </el-input>
      <!-- 校验密码强度等级 -->
      <el-progress :percentage="checkPasswordStrength(confirmPassword) * 100" striped status="success"></el-progress>
    </el-form-item>
    
    <!-- 密保问题 -->
    <el-form-item label="密保问题" style="width: 100%;">
      <!-- 读取密保问题和答案 循环 -->
      <div v-for="(item, index) in pwdQuestionListCc" :key="index">
        <div>问题{{ index + 1 }}: </div>
        <div class="problem">
          <div class="label">问题：</div>
          <el-input v-model="item.question" placeholder="请输入问题" :disabled="!item.isAdd"></el-input>
        </div>
        <div class="answer">
          <div class="label">答案：</div>
          <el-input type="textarea" rows="3" v-model="item.answer" placeholder="请输入答案"
            :disabled="!item.isAdd"></el-input>
        </div>
      </div>
      <!-- 如果列表长度小于3，可以新增密保问题 -->
      <el-button v-if="pwdQuestionListCc?.length < 3" @click="addPwdQuestion">新增密保问题</el-button>
      <!-- 保存 -->
      <div>
        <el-button @click="savePwdQuestion">保存</el-button>

      </div>
    </el-form-item>



  </el-form>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import useSafetyProtection from '@/store/useSafetyProtection';

const { passwordC, pwdQuestionListC } = storeToRefs(useSafetyProtection());
const { setPassword, isPwdSame, setPwdQuestionList } = useSafetyProtection();
const passwordCc = ref(passwordC.value);

watch(() => passwordC.value, (newVal) => {
  passwordCc.value = newVal;
})

const pwdQuestionListCc = ref(JSON.parse(JSON.stringify(pwdQuestionListC.value || [])));
watch(() => pwdQuestionListC.value, (newVal) => {
  pwdQuestionListCc.value = JSON.parse(JSON.stringify(newVal || []));
})

const newPassword = ref('');
const confirmPassword = ref('');
const verifyPassword = ref('');
const ischeckPassword = ref(false);

function updatePwd() {
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.error('两次密码输入不一致');
    return;
  }
  // 校验密码强度等级
  let strength = checkPasswordStrength(newPassword.value);
  console.log(strength);
  if (strength < 1) {
    // 提示校验通过的条件
    ElMessage.error('密码长度至少8位，包含数字、小写字母、大写字母、特殊字符，且不能有空格、连续字符');
    return;
  }
  setPassword(newPassword.value);
}

// 密码强度校验函数 
function checkPasswordStrength(password: string) {
  // 校验密码强度等级
  let strength = 0;
  // 密码长度
  let length = password.length;
  // 密码中是否包含数字
  let hasNumber = /\d/.test(password);
  // 密码中是否包含小写字母
  let hasLowercase = /[a-z]/.test(password);
  // 密码中是否包含大写字母
  let hasUppercase = /[A-Z]/.test(password);
  // 密码中是否包含特殊字符
  let hasSpecialChar = /[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/.test(password);
  // 密码中是否包含空格
  let hasSpace = /\s/.test(password);
  // 密码中是否包含连续字符
  let hasConsecutiveChar = (/(.)\1{1,}/.test(password));
  // 是否仅有数字和字母和特殊字符
  let onlyNumberAndLetterAndSpecialChar = (/(^[a-zA-Z0-9!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]+$)/.test(password));
  // 是否同时包含数字、字母、特殊字符的三种
  let hasNumberAndLetterAndSpecialChar = (hasNumber && hasLowercase && hasUppercase && hasSpecialChar);

  // 如果为包含空格字符串的情况
  if (hasSpace || !password) {
    return 0;
  }

  // 校验强度等级
  if (length >= 8) {
    strength++;
  }
  if (!hasSpace) {
    strength++;
  }
  if (!hasConsecutiveChar) {
    strength++;
  }
  if (onlyNumberAndLetterAndSpecialChar) {
    strength++;
  }
  if (hasNumberAndLetterAndSpecialChar) {
    strength++;
  }
  // 打印所有的校验结果
  console.log('密码长度：', length);
  console.log('是否包含数字：', hasNumber);
  console.log('是否包含小写字母：', hasLowercase);
  console.log('是否包含大写字母：', hasUppercase);
  console.log('是否包含特殊字符：', hasSpecialChar);
  console.log('是否包含空格：', hasSpace);
  console.log('是否包含连续字符：', hasConsecutiveChar);

  console.log('是否仅有数字和字母和特殊字符：', onlyNumberAndLetterAndSpecialChar);
  console.log('是否同时包含数字、字母、特殊字符的三种：', hasNumberAndLetterAndSpecialChar);
  console.log('强度等级：', strength);

  // 返回强度等级 比
  strength = strength / 5;
  return strength;
}

// 原密码和新密码校验
function checkPassword() {
  const hasSame = isPwdSame(verifyPassword.value, passwordCc.value)
  if (hasSame) {
    ElMessage.success('密码校验成功');
    ischeckPassword.value = true;
    return;
  } else {
    ElMessage.error('密码校验失败');

    return;
  }
}

// 新增密保问题
function addPwdQuestion() {
  pwdQuestionListCc.value.push({ question: '', answer: '', isAdd: true });
}

// 保存密保问题
function savePwdQuestion() {
  // 需要进行空值校验，在删除首尾空格后，判断是否为空字符串
  pwdQuestionListCc.value = pwdQuestionListCc.value.map((item: ObjectType) => ({
    ...item,
    question: (item.question || '').trim(),
    answer: (item.answer || '').trim()
  }));
  // 过滤掉空值对象
  const filteredPwdQuestions = pwdQuestionListCc.value.filter((item: ObjectType) => item.question && item.answer);
  // 获取isAdd为true的对象
  let addPwdQuestions = pwdQuestionListCc.value.filter((item: ObjectType) => item.isAdd).map((item: ObjectType) => toRaw({
    question: item.question,
    answer: item.answer,
  }));

  // 如果长度小于3，提示用户至少需要填写三个问题
  if (filteredPwdQuestions.length < 3) {
    ElMessage.error('至少需要填写三个问题');
    return;
  }
  console.log(toRaw(addPwdQuestions), pwdQuestionListCc.value, 'addPwdQuestions');

  setPwdQuestionList(toRaw(addPwdQuestions));
}

</script>

<style scoped lang="scss">
.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.cur-status {
  &-work {
    &::before {
      content: '•';
      color: #00ffbf;
      display: inline-block;
    }

    &::rest {
      content: '•';
      color: #ff0303;
      display: inline-block;
    }
  }
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.mode-ops {
  width: 100%;

  .mode-item {
    display: flex;
    margin-bottom: 10px;
  }

  .mode-label {
    width: 150px;
  }
}

.safetyProtection-form {
  padding: 24px;
  :deep(.el-form-item__content) {
    display: block;

    .el-form-item {
      margin-top: 10px;

      .el-form-item__label {
        height: unset;
        line-height: 1.2em;
        display: flex;
        align-items: center;
      }
    }
  }
}

.password {
  width: 100%;
  word-wrap: break-word;
  line-height: 1;
  color: #909399;
  border: 1px solid #dcdfe6;
  padding: 6px;
  border-radius: 6px;
}

.el-progress {
  width: 100%;
}

.problem,
.answer {
  display: flex;
  padding-top: 12px;

  .label {
    width: 4em;
  }
}
</style>
