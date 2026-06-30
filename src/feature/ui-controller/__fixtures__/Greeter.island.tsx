import { island } from '@/ui'

function Greeter({ name = 'friend' }: { name?: string }) {
  return <button>Hello {name}</button>
}

export default island(Greeter)
