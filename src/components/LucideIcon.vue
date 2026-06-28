<template>
  <div class="lucide-icon-box" :class="['lucide-icon-' + padding, 'lucide-icon-' + type]" 
    :title="title || undefined"
    :style="padding ? {
      padding: getPadding(padding),
      backgroundColor: getLightColor(color, 3),
    } : {}"> 
    <component
      :is="nameMap[name] || nameMap['Fullscreen']"
      class="lucide-icon"
      :size="size"
      :color="color"
      :stroke-width="strokeWidth"
      :absoluteStrokeWidth="false"
      :default-class="defaultClass"
    />
  </div>
</template>

<script setup lang="ts">
import { AlarmClock, AlarmClockCheck, AlarmClockMinus, AlarmClockPlus, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeInfo, Battery, BellPlus, BellRing, Bluetooth, BookMarked, BookmarkPlus, BookOpenText, Building2, Check, ChevronRight, CircleAlert, CircleCheck, CircleX, Clock, Clock1, CloudBackup, CloudSun, CloudSync, CloudUpload, Coffee, Coins, Columns3Cog, Container, Copy, Cpu, Crosshair, Database, EllipsisVertical, Eye, EyeOff, FileBox, FileCheck, Files, FileText, FileType, Folder, FolderCog, FolderOpen, FolderPlus, Folders, Fullscreen, GamepadDirectional, Globe, Hand, HardDrive, Haze, Headset, Hourglass, House, Info, Key, Keyboard, LaptopMinimal, LayoutDashboard, LibraryBig, Lightbulb, List, ListChevronsDownUp, ListChevronsUpDown, ListCollapse, Lock, LogOut, MapPin, Monitor, MonitorCheck, MonitorCloud, MonitorCog, MonitorX, Moon, MousePointerClick, Move, Notebook, Package2, PaintbrushVertical, Pause, Pen, Pencil, Play, Plug2, PlugZap, Plus, Printer, RefreshCcw, ScanEye, ScrollText, Search, Server, Settings, Share2, ShieldCog, ShieldCogCorner, ShieldQuestionMark, SquarePen, SquarePlay, StarCheck, Sun, SunMoon, TagPlus, Tags, Telescope, Timer, Toolbox, Trash, Trash2, TvMinimal, UnfoldVertical, Upload, UploadCloud, Usb, User, Wand, Webcam, WebcamOff, Wrench, X } from '@lucide/vue';
import { ref } from 'vue';
import { getLightColor } from '@/utils';
withDefaults(
  defineProps<{
    /** 图标名称（font_class），如 'search', 'plus', 'x' */
    name?: string
    /** 图标尺寸（px），默认 16 */
    size?: number,
    /** 图标颜色，默认 currentColor */
    color?: string,
    /** 图标线宽，默认 2 */
    strokeWidth?: number,
    /** 图标默认 class，默认 lucide-icon */
    defaultClass?: string,
    // box的内边距
    padding?: string | number,
    // box的类型：square, circle, rounded
    type?: 'square' | 'circle' | 'rounded',
    /** 鼠标悬停提示文字 */
    title?: string,
  }>(),
  {
    strokeWidth: 2,
    defaultClass: 'lucide-icon',
    color: 'currentColor',
    size: 16,
    name: Fullscreen.name, // 默认图标为 Fullscreen
    padding: 0,
    type: 'square',
    title: '',
  }
)

let nameMap = ref<Record<any, any>>({
  Fullscreen,
  // 其他图标可以在这里添加
  Timer,
  Coffee,
  Clock,
   ChevronRight,
  StarCheck,
  Hourglass,
  AlarmClockCheck,
  AlarmClockMinus,
  AlarmClockPlus,
  AlarmClock,
  CloudBackup,
  CloudSync,
  SquarePen,
  Pen,
  Play,
  Trash,
  Trash2,
  Pause,
  BellRing,
  BellPlus,
  Haze,
  FileBox,
  Files,
  FileText,
  Notebook,
  Upload,
  Key,
  Check,
  CircleX,
  Copy,
  CircleAlert,
  CircleCheck,
  ShieldCog,
  Telescope,
  FolderCog,
  FolderOpen,
  Folder,
  FolderPlus,
  Settings,
  Crosshair,
  LogOut,
  Sun,
  Lock,
  Monitor,
  MonitorCheck,
  MonitorCog,
  MonitorX,
  MonitorCloud,
  Coins,
  MousePointerClick,
  Columns3Cog,
  UnfoldVertical,
  PaintbrushVertical,
  LayoutDashboard,
  LibraryBig,
  Lightbulb,
  Webcam,
  Wand,
  MapPin,
  
  Database,
  WebcamOff,
  Share2,
  Wrench,
  CloudSun,
  Info,
  Toolbox,
  ListChevronsUpDown,
  ListChevronsDownUp,
  Cpu,
  HardDrive,
  Globe,
  Folders,
  Server,
  PlugZap,
  Plug2,
  ListCollapse,
  BookOpenText,
  LaptopMinimal,
  TvMinimal,
  Battery,
  Headset,
  Bluetooth,
  Usb,
  Printer,
  Container,
  GamepadDirectional,
  ScanEye,
  Eye,
  EyeOff,
  Search,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Plus,
  ArrowDown,
  BookmarkPlus,
  BookMarked,
  UploadCloud,
  CloudUpload,
  User,
  EllipsisVertical,
  List,
  X,
  TagPlus,
  House,
  Tags,
  ShieldCogCorner,
  ShieldQuestionMark,
  Pencil,
  Keyboard,
  RefreshCcw,
  Clock1,
  BadgeInfo,
  Building2,
  SquarePlay,
  FileType,
  Package2,
  ScrollText,
  Hand,
  Move,
  SunMoon,
  Moon,
  FileCheck,
})

function getPadding(padding: string | number): string {
  if (typeof padding === 'number') {
    return `${padding}px`;
  }
  return padding;
}


</script>

<style scoped lang="scss">
.lucide-icon {
  &-box {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  flex: 1;
  // box的类型type：square, circle, round
  &-square {
    border-radius: 0px;
  }
  &-circle {
    border-radius: 50%;
  }
  &-rounded {
    border-radius: 25%;
  }
}
</style>
