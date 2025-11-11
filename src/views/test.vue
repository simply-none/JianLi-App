<template>
  <el-button @click="send">
    测试
  </el-button>
  <!-- 接口测试 -->
  <div>
    <div>接口路径：</div>
    <div>请求方式：<el-radio-group v-model="method" size="small">
      <el-radio value="get">get</el-radio>
      <el-radio value="post">post</el-radio>
    </el-radio-group></div>
    <div>请求头：<el-input spellcheck="false" v-model="header" /></div>
    <div>请求体：<el-input spellcheck="false" v-model="body" /></div>
    <div>返回结果：<el-input spellcheck="false" type='textarea' :rows='20' v-model="result" /></div>
    <el-tabs v-model="activeName" class="demo-tabs" @tab-click="handleClick">
      <el-tab-pane label="原始数据" name="original">
        <el-input spellcheck="false" type='textarea' :rows='20' v-model="result" />
      </el-tab-pane>
      <el-tab-pane label="格式化数据" name="formatted">
        <div v-html="result"></div>
      </el-tab-pane>
    </el-tabs>
    <div>
      <el-button @click="sendRequest">发送</el-button>
    </div>
  </div>
  <div class="parent">
      <DraggableContainer>
        <Vue3DraggableResizable :init-h="div1.h" :init-w="div1.w" v-model:x="div1.x" v-model:y="div1.y" v-model:w="div1.w" v-model:h="div1.h" @drag-end="dragEndDiv1" @resize-end="resizeEndDiv1">
          <div class='div1'>Test</div>
        </Vue3DraggableResizable>
        <Vue3DraggableResizable :init-h="div2.h" :init-w="div2.w"  v-model:x="div2.x" v-model:y="div2.y" v-model:w="div2.w" v-model:h="div2.h" @drag-end="dragEndDiv2" @resize-end="resizeEndDiv2">
          <div class="div2">Test</div>
        </Vue3DraggableResizable>
      </DraggableContainer>
    </div>
  <!-- 退出 -->
  <el-button @click="quitApp">退出</el-button>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import moment from 'moment';
import Vue3DraggableResizable, { DraggableContainer } from 'vue3-draggable-resizable'
import 'vue3-draggable-resizable/dist/Vue3DraggableResizable.css'

function send() {
  console.warn("测试", window.ipcRenderer);
  console.log(moment().isBetween(moment('11:50', 'HH:mm'), moment('15:30', 'HH:mm')), 't')
  console.log(moment().diff(moment('13:30', 'HH:mm'), 'seconds', true), '3')
  console.log(window.ipcRenderer.sendSync("test", "测试"), 't')
}

window.ipcRenderer.on("test", (event, arg) => {
  console.warn(arg);
});

function quitApp() {
    window.ipcRenderer.send('quit-app');
}

// ------接口测试 start------
const url = ref('');
const method = ref('get');
const header = ref('');
const body = ref('');
const result = ref('');

const div1 = ref({
  x: 10,
  y: 10,
  w: 100,
  h: 100,
})
const div2 = ref({
  x: 100,
  y: 100,
  w: 100, 
  h: 100,
})

const position = localStorage.getItem('position');
const position2 = localStorage.getItem('position2');
if (position) {
  const {x, y, w, h} = JSON.parse(position);
  const a = {x, y, w, h}
  console.log(x, y, w, h, 'w x y')
console.log(a, 'a')
  div1.value = a
}
if (position2) {
  const {x, y, w, h} = JSON.parse(position2);
  div2.value = {x, y, w, h} 
}

function dragEndDiv1() {
  localStorage.setItem('position', JSON.stringify(div1.value));
}
function dragEndDiv2() {
  localStorage.setItem('position2', JSON.stringify(div2.value)); 
}

function resizeEndDiv1() {
  localStorage.setItem('position', JSON.stringify(div1.value));
}
function resizeEndDiv2() {
  localStorage.setItem('position2', JSON.stringify(div2.value)); 
}

function sendRequest() {
  if (!url.value) {
    return ElMessage.warning('请输入接口路径');
  }  
  window.ipcRenderer.send("api-test", {
    url: url.value,
    method: method.value,
    header: header.value, 
    body: body.value,
  })
}

window.ipcRenderer.on("api-test", (event, arg) => {
  console.warn(arg, 't');
  result.value = JSON.stringify(arg, null, 2);
});

</script>

<style lang="scss" scoped>
div {
  padding: 2px;
}
.parent {
  width: 0px;
  height: 0px;
  position: absolute;
  top: 0px;
  left: 0px;
  user-select: none;
}
.div1 {
  width: 100%;
  height: 100%;
  color: white;
  background-color: #000;
}

.div2 {
  width: 100%;
  height: 100%;
  background-color: red;
}
</style>