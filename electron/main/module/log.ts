import log from 'electron-log'
import { appRoot } from '../variables.ts'

export function initLog() {
  log.transports.file.resolvePathFn = () => {
    return `${appRoot}/logs/main.log`
  }

  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'

  log.errorHandler.startCatching({
    showDialog: true,
    onError: (options) => {
      log.error(options)
    },
  })

  log.eventLogger.startLogging()
}
