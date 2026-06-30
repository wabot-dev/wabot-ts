import { island, signal } from '@/ui'

function Counter({ start = 0 }: { start?: number }) {
  const count = signal(start)
  return <button onClick={() => count.value++}>{count}</button>
}

export default island(Counter)
