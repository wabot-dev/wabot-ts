import { isNotEmpty, isString } from '@/core/validation'
import { uiController, view, action, redirect } from '@/ui'
import Counter from './Counter.island'

// A trivial in-memory store; swap for a real @repository service.
const messages: string[] = ['Welcome to Wabot UI']

// Action input is a validated DTO, exactly like rest-controller request models.
class AddMessageDto {
  @isString()
  @isNotEmpty()
  text?: string
}

@uiController('/')
export class EliaUiController {
  @view({ title: 'Elia UI' })
  index() {
    return (
      <main>
        <h1>Wabot UI</h1>
        <ul>
          {messages.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>

        {/* Interactive island: ships JS and hydrates on the client */}
        <Counter start={messages.length} />

        {/* Progressive-enhancement form posting to the action below */}
        <form method="post" action="/_action/add">
          <input name="text" placeholder="Add a message" />
          <button type="submit">Add</button>
        </form>
      </main>
    )
  }

  @action()
  add(input: AddMessageDto) {
    // `input` is already validated (text is a required, non-empty string).
    messages.push(input.text!)
    return redirect('/')
  }
}
