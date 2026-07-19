type OtelApi = typeof import('@opentelemetry/api')

let api: OtelApi | null = null
let loaded = false

export type SpanAttributes = Record<string, string | number | boolean | undefined>

const TRACER_NAME = 'wabot'
const METER_NAME = 'wabot'
const INVALID_TRACE_ID = '00000000000000000000000000000000'

/**
 * Load `@opentelemetry/api` if the app installed it (an optional peer dependency).
 * Idempotent. When it is absent, every helper below is a zero-overhead no-op.
 * Spans and metrics only reach a backend once the app also registers an OTel SDK
 * (`@opentelemetry/sdk-node` + an exporter) at startup — the framework just emits
 * them through the API.
 */
export async function initTelemetry(): Promise<boolean> {
  if (loaded) return api !== null
  loaded = true
  try {
    api = await import('@opentelemetry/api')
  } catch {
    api = null
  }
  return api !== null
}

/** Whether `@opentelemetry/api` was loaded. */
export function telemetryEnabled(): boolean {
  return api !== null
}

/** Test hook: inject or clear the OTel api module. */
export function setTelemetryApi(module: OtelApi | null): void {
  api = module
  loaded = true
}

function cleanAttributes(attributes?: SpanAttributes): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!attributes) return out
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

/**
 * Run `fn` inside an active span (its parent is the current span, so nesting
 * works). Records exceptions and sets the span status. A transparent passthrough
 * when OTel is not installed.
 */
export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: () => Promise<T>,
): Promise<T> {
  const otel = api
  if (!otel) return fn()

  return otel.trace
    .getTracer(TRACER_NAME)
    .startActiveSpan(name, { attributes: cleanAttributes(attributes) }, async (span) => {
      try {
        const result = await fn()
        span.setStatus({ code: otel.SpanStatusCode.OK })
        return result
      } catch (err) {
        span.recordException(err as Error)
        span.setStatus({
          code: otel.SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        })
        throw err
      } finally {
        span.end()
      }
    })
}

/** Add attributes to the currently active span (e.g. values known mid-operation). No-op without OTel. */
export function setSpanAttributes(attributes: SpanAttributes): void {
  if (!api) return
  api.trace.getActiveSpan()?.setAttributes(cleanAttributes(attributes))
}

const counters = new Map<
  string,
  ReturnType<ReturnType<OtelApi['metrics']['getMeter']>['createCounter']>
>()

/** Increment a counter metric. No-op without OTel. */
export function addCount(name: string, value = 1, attributes?: SpanAttributes): void {
  if (!api) return
  let counter = counters.get(name)
  if (!counter) {
    counter = api.metrics.getMeter(METER_NAME).createCounter(name)
    counters.set(name, counter)
  }
  counter.add(value, cleanAttributes(attributes))
}

const histograms = new Map<
  string,
  ReturnType<ReturnType<OtelApi['metrics']['getMeter']>['createHistogram']>
>()

/** Record a value into a histogram metric (e.g. a latency in ms). No-op without OTel. */
export function recordValue(name: string, value: number, attributes?: SpanAttributes): void {
  if (!api) return
  let histogram = histograms.get(name)
  if (!histogram) {
    histogram = api.metrics.getMeter(METER_NAME).createHistogram(name)
    histograms.set(name, histogram)
  }
  histogram.record(value, cleanAttributes(attributes))
}

/**
 * The active span's trace/span ids, for correlating logs with traces. `undefined`
 * when OTel is off or no span is active (or the span is non-recording).
 */
export function activeTraceContext(): { traceId: string; spanId: string } | undefined {
  if (!api) return undefined
  const span = api.trace.getActiveSpan()
  if (!span) return undefined
  const ctx = span.spanContext()
  if (!ctx || !ctx.traceId || ctx.traceId === INVALID_TRACE_ID) return undefined
  return { traceId: ctx.traceId, spanId: ctx.spanId }
}
