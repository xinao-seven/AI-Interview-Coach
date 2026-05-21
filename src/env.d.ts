/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'element-plus/dist/locale/zh-cn.mjs' {
  interface ElementPlusLanguage {
    name: string
    el: Record<string, string | string[] | Record<string, unknown>>
  }
  const zhCn: ElementPlusLanguage
  export default zhCn
}
