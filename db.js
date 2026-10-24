/**
 * 最简「数据库」：一行一条 JSON 的追加文件。
 * 以后换 SQLite 只需要替换这个文件里的 append()。
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

export function createDb(file) {
  let tail = Promise.resolve()
  return {
    path: file,
    append(record) {
      tail = tail.catch(() => {})
        .then(async () => {
          await mkdir(dirname(file), { recursive: true })
          await appendFile(file, JSON.stringify(record) + '\n', 'utf8')
        })

      return tail
    },
  }
}
