<template>
  <div class="safety-protection">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Lock /></el-icon>
        安全防护
      </h2>
      <p class="page-desc">管理您的账户安全设置</p>
    </div>

    <div class="section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><Key /></el-icon>
          密码设置
        </h3>
      </div>

      <div class="security-card">
        <div class="form-group" v-if="passwordC">
          <label class="form-label">
            <el-icon class="label-icon"><Lock /></el-icon>
            当前密码状态
          </label>
          <div class="password-status">
            <el-tag type="info" size="large">
              <el-icon><Check /></el-icon>
              已设置密码保护
            </el-tag>
          </div>
        </div>

        <div class="form-group" v-if="!passwordC">
          <label class="form-label">
            <el-icon class="label-icon"><Lock /></el-icon>
            当前密码状态
          </label>
          <div class="password-status">
            <el-tag type="warning" size="large">
              <el-icon><CircleClose /></el-icon>
              未设置密码
            </el-tag>
            <p class="status-hint">建议设置密码以保护您的数据安全</p>
          </div>
        </div>

        <div class="form-group" v-if="passwordC">
          <label class="form-label">
            <el-icon class="label-icon"><Lock /></el-icon>
            原密码校验
          </label>
          <el-input 
            v-model="verifyPassword" 
            type="password" 
            placeholder="请输入原密码进行校验"
            class="form-input"
            @keyup.enter="checkPassword"
          >
            <template #suffix>
              <el-button type="primary" @click="checkPassword">
                <el-icon><Check /></el-icon>
                校验
              </el-button>
            </template>
          </el-input>
          <div v-if="showValidatePwdQuestionBtn" class="validate-hint">
            <el-icon class="hint-icon"><Warning /></el-icon>
            密码校验失败，是否通过密保问题重置密码？
            <el-button type="text" @click="showValidatePwdQuestion = true">校验密保问题</el-button>
          </div>
        </div>

        <div v-if="ischeckPassword" class="password-section">
          <div class="form-group">
            <label class="form-label">
              <el-icon class="label-icon"><Key /></el-icon>
              新密码
            </label>
            <el-input 
              v-model="newPassword" 
              type="password" 
              placeholder="请输入新密码"
              class="form-input"
              @keyup.enter="updatePwd"
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
            <div class="password-strength">
              <div class="strength-label">密码强度：{{ getStrengthLabel(newPassword) }}</div>
              <div class="strength-bars">
                <div 
                  v-for="i in 5" 
                  :key="i" 
                  class="strength-bar"
                  :class="getStrengthClass(newPassword, i)"
                ></div>
              </div>
              <div class="strength-tips">
                <span v-if="newPassword">至少8位，包含数字、大小写字母和特殊字符</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <el-icon class="label-icon"><Key /></el-icon>
              确认密码
            </label>
            <el-input 
              v-model="confirmPassword" 
              type="password" 
              placeholder="请再次输入新密码"
              class="form-input"
              @keyup.enter="updatePwd"
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
              <template #suffix>
                <el-icon v-if="confirmPassword && newPassword === confirmPassword" color="#67c23a"><Check /></el-icon>
                <el-icon v-else-if="confirmPassword" color="#f56c6c"><Close /></el-icon>
              </template>
            </el-input>
            <div v-if="confirmPassword" class="match-hint" :class="newPassword === confirmPassword ? 'match' : 'mismatch'">
              <el-icon>{{ newPassword === confirmPassword ? 'Check' : 'Close' }}</el-icon>
              {{ newPassword === confirmPassword ? '两次输入一致' : '两次输入不一致' }}
            </div>
          </div>

          <div class="form-actions">
            <el-button type="primary" size="large" @click="updatePwd">
              <el-icon><DocumentChecked /></el-icon>
              保存密码
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3 class="section-title">
          <el-icon><QuestionFilled /></el-icon>
          密保问题
        </h3>
      </div>

      <div class="security-card">
        <div class="card-actions">
          <el-button @click="showValidatePwdQuestionList = !showValidatePwdQuestionList">
            <el-icon v-if="showValidatePwdQuestionList"><ArrowUp /></el-icon>
            <el-icon v-else><ArrowDown /></el-icon>
            {{ showValidatePwdQuestionList ? '收起' : '显示密保问题' }}
          </el-button>
        </div>

        <div v-if="showValidatePwdQuestionList" class="question-list">
          <div 
            v-for="(item, index) in pwdQuestionListCc" 
            :key="index" 
            class="question-card"
          >
            <div class="question-header">
              <span class="question-index">问题 {{ index + 1 }}</span>
              <el-tag size="small" v-if="item.isAdd" type="success">新增</el-tag>
            </div>
            <div class="question-body">
              <div class="question-field">
                <label>问题内容</label>
                <el-input 
                  v-model="item.question" 
                  placeholder="请输入密保问题"
                  :disabled="!item.isAdd"
                  class="question-input"
                />
              </div>
              <div class="answer-field">
                <label>答案</label>
                <el-input 
                  v-model="item.answer" 
                  type="textarea" 
                  :rows="2"
                  placeholder="请输入答案"
                  :disabled="!item.isAdd"
                  class="question-input"
                />
              </div>
            </div>
          </div>

          <div v-if="pwdQuestionListCc?.length < 3" class="add-question">
            <el-button type="primary" plain @click="addPwdQuestion">
              <el-icon><Plus /></el-icon>
              新增密保问题
            </el-button>
          </div>

          <div class="form-actions">
            <el-button type="primary" @click="savePwdQuestion">
              <el-icon><DocumentChecked /></el-icon>
              保存密保问题
            </el-button>
          </div>
        </div>

        <div v-else class="empty-hint">
          <el-icon :size="48" color="var(--text-muted)">
            <FileQuestion />
          </el-icon>
          <p>点击上方按钮查看密保问题</p>
        </div>
      </div>
    </div>

    <div v-if="showValidatePwdQuestion" class="modal-overlay">
      <div class="verify-modal">
        <div class="modal-header">
          <h3>验证密保问题</h3>
          <el-button type="text" @click="showValidatePwdQuestion = false">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>

        <div class="modal-steps">
          <el-steps :active="activeAnswer" finish-status="success">
            <el-step v-for="(val, idx) in pwdQuestionListCc" :key="idx" :title="'问题 ' + (idx + 1)" />
          </el-steps>
        </div>

        <div class="modal-body">
          <div v-if="pwdQuestionListCc[activeAnswer]" class="verify-form">
            <div class="verify-question">
              <el-icon><HelpFilled /></el-icon>
              <span>{{ pwdQuestionListCc[activeAnswer].question }}</span>
            </div>
            <el-input 
              v-model="pwdQuestionListCc[activeAnswer].answerValid" 
              type="textarea"
              :rows="3"
              placeholder="请输入答案"
              class="verify-input"
            />
          </div>
        </div>

        <div class="modal-footer">
          <el-button @click="showValidatePwdQuestion = false">取消</el-button>
          <el-button type="primary" @click="validatePwdQuestion">
            {{ activeAnswer + 1 === pwdQuestionListCc?.length ? '验证完成' : '下一步' }}
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import { Lock, Key, Check, Close, CircleClose, Warning, DocumentChecked, Plus, ArrowUp, ArrowDown, HelpFilled, QuestionFilled } from '@element-plus/icons-vue';
import useSafetyProtection from '@/store/useSafetyProtection';

const { passwordC, pwdQuestionListC } = storeToRefs(useSafetyProtection());
const { setPassword, isPwdSame, setPwdQuestionList } = useSafetyProtection();
const passwordCc = ref(passwordC.value);
const ischeckPassword = ref(false);
const activeAnswer = ref(0);
const showValidatePwdQuestion = ref(false);
const showValidatePwdQuestionBtn = ref(false);
const showValidatePwdQuestionList = ref(false);

watch(() => passwordC.value, (newVal) => {
  passwordCc.value = newVal;
  ischeckPassword.value = passwordCc.value ? false : true;
}, { immediate: true, deep: true });

const pwdQuestionListCc = ref(JSON.parse(JSON.stringify(pwdQuestionListC.value || [])));
watch(() => pwdQuestionListC.value, (newVal) => {
  pwdQuestionListCc.value = JSON.parse(JSON.stringify(newVal || []));
});

const newPassword = ref('');
const confirmPassword = ref('');
const verifyPassword = ref('');

function updatePwd() {
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.error('两次密码输入不一致');
    return;
  }
  let strength = checkPasswordStrength(newPassword.value);
  if (strength < 1) {
    ElMessage.error('密码长度至少8位，包含数字、小写字母、大写字母、特殊字符，且不能有空格、连续字符');
    return;
  }
  setPassword(newPassword.value);
}

function checkPasswordStrength(password: string) {
  let strength = 0;
  let length = password.length;
  let hasNumber = /\d/.test(password);
  let hasLowercase = /[a-z]/.test(password);
  let hasUppercase = /[A-Z]/.test(password);
  let hasSpecialChar = /[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/.test(password);
  let hasSpace = /\s/.test(password);
  let hasConsecutiveChar = /(.)\1{1,}/.test(password);
  let onlyNumberAndLetterAndSpecialChar = /(^[a-zA-Z0-9!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]+$)/.test(password);
  let hasNumberAndLetterAndSpecialChar = (hasNumber && hasLowercase && hasUppercase && hasSpecialChar);

  if (hasSpace || !password) {
    return 0;
  }

  if (length >= 8) strength++;
  if (!hasSpace) strength++;
  if (!hasConsecutiveChar) strength++;
  if (onlyNumberAndLetterAndSpecialChar) strength++;
  if (hasNumberAndLetterAndSpecialChar) strength++;

  return strength / 5;
}

function getStrengthLabel(password: string) {
  const strength = Math.round(checkPasswordStrength(password) * 5);
  if (strength === 0) return '未输入';
  if (strength <= 1) return '弱';
  if (strength <= 2) return '一般';
  if (strength <= 3) return '强';
  return '非常强';
}

function getStrengthClass(password: string, index: number) {
  const strength = Math.round(checkPasswordStrength(password) * 5);
  if (index <= strength) {
    if (strength <= 1) return 'weak';
    if (strength <= 2) return 'medium';
    if (strength <= 3) return 'strong';
    return 'very-strong';
  }
  return '';
}

function checkPassword() {
  if (!passwordCc.value) {
    ElMessage.error('当前系统无原密码，校验通过');
    ischeckPassword.value = true;
    return;
  }

  const hasSame = isPwdSame(verifyPassword.value, passwordCc.value)
  if (hasSame) {
    ElMessage.success('密码校验成功');
    ischeckPassword.value = true;
    return;
  } else {
    ElMessage.error('密码校验失败');
    showValidatePwdQuestionBtn.value = true;
    return;
  }
}

function addPwdQuestion() {
  pwdQuestionListCc.value.push({ question: '', answer: '', isAdd: true });
}

function savePwdQuestion() {
  pwdQuestionListCc.value = pwdQuestionListCc.value.map((item: ObjectType) => ({
    ...item,
    question: (item.question || '').trim(),
    answer: (item.answer || '').trim()
  }));

  const filteredPwdQuestions = pwdQuestionListCc.value.filter((item: ObjectType) => item.question && item.answer);

  if (filteredPwdQuestions.length < 3) {
    ElMessage.error('至少需要填写三个问题');
    return;
  }

  let addPwdQuestions = pwdQuestionListCc.value.filter((item: ObjectType) => item.isAdd).map((item: ObjectType) => toRaw({
    question: item.question,
    answer: item.answer,
  }));

  setPwdQuestionList(toRaw(addPwdQuestions));
}

function validatePwdQuestion() {
  const item = pwdQuestionListCc.value[activeAnswer.value];
  const hasSame = isPwdSame(item.answerValid, item.answer)
  if (hasSame) {
    activeAnswer.value = activeAnswer.value + 1;

    if (activeAnswer.value == pwdQuestionListCc.value?.length) {
      ElMessage.success('密保验证成功，请重置密码');
      showValidatePwdQuestion.value = false;
      activeAnswer.value = 0;
      ischeckPassword.value = true;
      return;
    } else {
      ElMessage.success('问题验证成功');
    }
  } else {
    ElMessage.error('问题验证失败');
    return;
  }
}
</script>

<style scoped lang="scss">
.safety-protection {
  // padding: 24px;
  min-height: 100%;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 32px;

  .page-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0;

    .el-icon {
      color: var(--color-primary);
    }
  }

  .page-desc {
    font-size: 14px;
    color: var(--text-muted);
    margin: 6px 0 0;
  }
}

.section {
  margin-bottom: 28px;

  .section-header {
    margin-bottom: 16px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }
  }
}

.security-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 24px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }
}

.form-group {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 10px;

    .label-icon {
      color: var(--color-primary);
      font-size: 16px;
    }
  }

  .form-input {
    width: 100%;
  }
}

.password-status {
  display: flex;
  align-items: center;
  gap: 12px;

  .status-hint {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }
}

.validate-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
  font-size: 13px;
  color: #f56c6c;

  .hint-icon {
    font-size: 16px;
  }

  .el-button {
    padding: 0;
    margin-left: 8px;
    font-weight: 600;
  }
}

.password-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-subtle);
}

.password-strength {
  margin-top: 12px;

  .strength-label {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .strength-bars {
    display: flex;
    gap: 6px;

    .strength-bar {
      flex: 1;
      height: 6px;
      background: var(--bg-hover);
      border-radius: 3px;
      transition: all 0.3s ease;

      &.weak {
        background: #f56c6c;
      }

      &.medium {
        background: #e6a23c;
      }

      &.strong {
        background: #67c23a;
      }

      &.very-strong {
        background: #409eff;
      }
    }
  }

  .strength-tips {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 6px;
  }
}

.match-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 13px;

  &.match {
    color: #67c23a;
  }

  &.mismatch {
    color: #f56c6c;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);

  .el-button {
    padding: 10px 24px;
    font-size: 14px;
  }
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.question-list {
  .question-card {
    background: var(--bg-hover);
    border-radius: var(--radius-card);
    padding: 16px;
    margin-bottom: 12px;
    transition: all 0.2s ease;

    &:hover {
      background: var(--color-primary-light);
    }

    .question-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      .question-index {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .question-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .question-field,
    .answer-field {
      display: flex;
      flex-direction: column;
      gap: 6px;

      label {
        font-size: 13px;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .question-input {
        width: 100%;
      }
    }
  }

  .add-question {
    margin-top: 16px;
    text-align: center;

    .el-button {
      padding: 10px 32px;
    }
  }
}

.empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--text-muted);

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.verify-modal {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  width: 90%;
  max-width: 500px;
  overflow: hidden;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border-subtle);

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }
  }

  .modal-steps {
    padding: 20px 24px;
  }

  .modal-body {
    padding: 24px;

    .verify-form {
      .verify-question {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 16px;
        background: var(--bg-hover);
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 15px;
        color: var(--text-primary);
        line-height: 1.6;

        .el-icon {
          flex-shrink: 0;
          color: var(--color-primary);
        }
      }

      .verify-input {
        width: 100%;
      }
    }
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--border-subtle);

    .el-button {
      padding: 10px 24px;
    }
  }
}
</style>