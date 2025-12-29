import { Pool, PoolClient } from 'pg'
import { getPgClient } from './withPgClient'

let savepointCounter = 0

export async function withPgTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  // Always get the shared client
  const client = getPgClient(pool) as PoolClient

  if (!('__transactionStack' in client)) {
    ;(client as any).__transactionStack = []
  }

  const stack: (string | null)[] = (client as any).__transactionStack

  const isOuterTransaction = stack.length === 0
  const savepointName = isOuterTransaction ? null : `sp_${++savepointCounter}`

  if (savepointName) await client.query(`SAVEPOINT ${savepointName}`)
  if (isOuterTransaction) await client.query('BEGIN')

  stack.push(savepointName || 'outer')

  try {
    const result = await fn(client)

    if (savepointName) {
      await client.query(`RELEASE SAVEPOINT ${savepointName}`)
    } else if (isOuterTransaction) {
      await client.query('COMMIT')
    }

    stack.pop()
    if (isOuterTransaction) delete (client as any).__transactionStack

    return result
  } catch (err) {
    if (savepointName) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`)
    } else if (isOuterTransaction) {
      await client.query('ROLLBACK')
    }

    stack.pop()
    if (isOuterTransaction) delete (client as any).__transactionStack

    throw err
  }
}
