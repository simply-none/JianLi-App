import { devtools } from '@vue/devtools'

export function initDevtools() {
  if (process.env.NODE_ENV === 'development')
    devtools.connect("http://localhost", 8098)
}