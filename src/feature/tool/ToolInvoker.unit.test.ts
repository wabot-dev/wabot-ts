import assert from 'node:assert/strict'
import test from 'node:test'

import { container, Container } from '@/core/injection'
import { description, DescriptionMetadataStore } from '@/core/description'
import { isNumber } from '@/core/validation'
import { tools } from './@tools'
import { ToolInvoker } from './ToolInvoker'
import { ToolMetadataStore } from './ToolMetadataStore'

class AddReq {
  @isNumber()
  @description('first addend')
  a: number = 0

  @isNumber()
  @description('second addend')
  b: number = 0
}

const calls: string[] = []

@tools()
class CalculatorTools {
  @description('Add two numbers and return the sum')
  add(req: AddReq) {
    calls.push(`add:${req.a}+${req.b}`)
    return req.a + req.b
  }
}

@tools({ exposeToMindsets: false })
class AdminTools {
  @description('Reset everything (privileged)')
  reset() {
    calls.push('reset')
    return 'done'
  }
}

function makeInvoker(options = {}) {
  return new ToolInvoker(
    [CalculatorTools, AdminTools],
    container as unknown as Container,
    container.resolve(ToolMetadataStore),
    container.resolve(DescriptionMetadataStore),
    options,
  )
}

test('schema() exposes every tool function with typed params by default', () => {
  const schema = makeInvoker().schema()
  const add = schema.find((t) => t.name === 'add')
  assert.ok(add, 'add tool present')
  assert.equal(add!.parameters.length, 2)
  assert.equal(add!.parameters.find((p) => p.name === 'a')?.schema.type, 'number')
  assert.ok(
    schema.find((t) => t.name === 'reset'),
    'reset present without gating',
  )
})

test('call() validates arguments and dispatches to the tool instance', async () => {
  const result = await makeInvoker().call('add', JSON.stringify({ a: 2, b: 3 }))
  assert.equal(result, '5')
})

test('call() returns INVALID_ARGUMENTS for bad args', async () => {
  const result = await makeInvoker().call('add', JSON.stringify({ a: 'x', b: 3 }))
  assert.match(result, /INVALID_ARGUMENTS/)
})

test('forMindset hides exposeToMindsets:false tools', async () => {
  const invoker = makeInvoker({ forMindset: true })
  const schema = invoker.schema()
  assert.ok(schema.find((t) => t.name === 'add'))
  assert.equal(
    schema.find((t) => t.name === 'reset'),
    undefined,
    'reset hidden from mindsets',
  )
  const blocked = await invoker.call('reset', '{}')
  assert.match(blocked, /TOOL_NOT_ALLOWED/)
})

test('allow-list restricts schema and calls', async () => {
  const invoker = makeInvoker({ allow: [CalculatorTools] })
  assert.deepEqual(
    invoker.schema().map((t) => t.name),
    ['add'],
  )
  const blocked = await invoker.call('reset', '{}')
  assert.match(blocked, /TOOL_NOT_ALLOWED/)
})

test('deny-list removes a tool by function name', () => {
  const invoker = makeInvoker({ deny: ['add'] })
  assert.deepEqual(
    invoker.schema().map((t) => t.name),
    ['reset'],
  )
})

@tools()
class MoreCalculatorTools {
  @description('Add two numbers (a second, conflicting definition)')
  add(req: AddReq) {
    return req.a + req.b
  }
}

test('schema() fails fast on a duplicate tool name across classes', () => {
  const invoker = new ToolInvoker(
    [CalculatorTools, MoreCalculatorTools],
    container as unknown as Container,
    container.resolve(ToolMetadataStore),
    container.resolve(DescriptionMetadataStore),
  )
  assert.throws(() => invoker.schema(), /Duplicate tool name.*'add'/s)
})

test('a duplicate can be resolved by excluding one side with deny', () => {
  const invoker = new ToolInvoker(
    [CalculatorTools, MoreCalculatorTools],
    container as unknown as Container,
    container.resolve(ToolMetadataStore),
    container.resolve(DescriptionMetadataStore),
    { deny: [MoreCalculatorTools] },
  )
  assert.deepEqual(
    invoker.schema().map((t) => t.name),
    ['add'],
  )
})

test('the same class listed twice is not a false conflict', () => {
  const invoker = new ToolInvoker(
    [CalculatorTools, CalculatorTools],
    container as unknown as Container,
    container.resolve(ToolMetadataStore),
    container.resolve(DescriptionMetadataStore),
  )
  assert.deepEqual(
    invoker.schema().map((t) => t.name),
    ['add'],
  )
})
