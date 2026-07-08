import log from 'electron-log'
import { logDir } from '../variables.ts'

export function initLog() {
  log.transports.file.resolvePathFn = () => {
    return `${logDir}/main.log`
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
