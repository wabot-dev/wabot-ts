import test, { after, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

import * as otelApi from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'

import { Logger } from '@/core/logger'
import {
  activeTraceContext,
  addCount,
  recordValue,
  setSpanAttributes,
  setTelemetryApi,
  withSpan,
} from './telemetry'

test.describe('telemetry — no OTel installed (default)', () => {
  before(() => setTelemetryApi(null))

  test('withSpan is a transparent passthrough', async () => {
    assert.equal(await withSpan('op', {}, async () => 42), 42)
  })

  test('withSpan still rethrows', async () => {
    await assert.rejects(
      () =>
        withSpan('op', {}, async () => {
          throw new Error('boom')
        }),
      /boom/,
    )
  })

  test('metrics and setSpanAttributes are safe no-ops; no active trace', () => {
    addCount('c', 1, { a: 'b' })
    recordValue('h', 5)
    setSpanAttributes({ k: 'v' })
    assert.equal(activeTraceContext(), undefined)
  })
})

test.describe('telemetry — OTel active', () => {
  const exporter = new InMemorySpanExporter()
  const contextManager = new AsyncLocalStorageContextManager()

  before(() => {
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    })
    otelApi.trace.setGlobalTracerProvider(provider)
    otelApi.context.setGlobalContextManager(contextManager.enable())
    setTelemetryApi(otelApi)
  })

  after(() => {
    setTelemetryApi(null)
    contextManager.disable()
    otelApi.trace.disable()
    otelApi.context.disable()
  })

  beforeEach(() => exporter.reset())

  test('records a span with name + attributes and OK status', async () => {
    await withSpan('op', { 'a.attr': 'v', n: 3 }, async () => {})
    const [span] = exporter.getFinishedSpans()
    assert.equal(span.name, 'op')
    assert.equal(span.attributes['a.attr'], 'v')
    assert.equal(span.attributes['n'], 3)
    assert.equal(span.status.code, otelApi.SpanStatusCode.OK)
  })

  test('records the exception + ERROR status and rethrows', async () => {
    await assert.rejects(
      () =>
        withSpan('op', {}, async () => {
          throw new Error('kaboom')
        }),
      /kaboom/,
    )
    const [span] = exporter.getFinishedSpans()
    assert.equal(span.status.code, otelApi.SpanStatusCode.ERROR)
    assert.ok(span.events.some((e) => e.name === 'exception'))
  })

  test('activeTraceContext returns the active span traceId', async () => {
    let inside: string | undefined
    await withSpan('op', {}, async () => {
      inside = activeTraceContext()?.traceId
    })
    const [span] = exporter.getFinishedSpans()
    assert.equal(inside, span.spanContext().traceId)
    assert.equal(inside?.length, 32)
  })

  test('setSpanAttributes adds to the active span', async () => {
    await withSpan('op', {}, async () => setSpanAttributes({ added: 'yes' }))
    assert.equal(exporter.getFinishedSpans()[0].attributes['added'], 'yes')
  })

  test('logs carry the active traceId (JSON)', async () => {
    Logger.configure({ format: 'json', level: 'info' })
    const lines: string[] = []
    const original = process.stdout.write
    try {
      await withSpan('op', {}, async () => {
        ;(process.stdout as any).write = (chunk: any) => {
          lines.push(String(chunk))
          return true
        }
        try {
          new Logger('test:trace').info('inside span')
        } finally {
          ;(process.stdout as any).write = original
        }
      })
    } finally {
      Logger.configure({ format: null, level: null })
    }
    const record = JSON.parse(lines[0])
    assert.equal(record.traceId, exporter.getFinishedSpans()[0].spanContext().traceId)
  })
})

test.describe('telemetry — metrics', () => {
  const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
  let provider: MeterProvider

  before(() => {
    provider = new MeterProvider({
      readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 1_000_000 })],
    })
    otelApi.metrics.setGlobalMeterProvider(provider)
    setTelemetryApi(otelApi)
  })

  after(async () => {
    setTelemetryApi(null)
    otelApi.metrics.disable()
    await provider.shutdown()
  })

  test('addCount emits a counter with attributes', async () => {
    addCount('wabot.llm.input_tokens', 42, { model: 'gpt' })
    await provider.forceFlush()

    const point = exporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics)
      .flatMap((sm) => sm.metrics)
      .find((m) => m.descriptor.name === 'wabot.llm.input_tokens')
      ?.dataPoints.find((p) => p.attributes.model === 'gpt')

    assert.equal(point?.value, 42)
  })
})
