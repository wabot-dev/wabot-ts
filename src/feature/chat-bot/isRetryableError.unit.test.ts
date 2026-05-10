import test from 'node:test'
import assert from 'node:assert/strict'
import { isRetryableError } from './isRetryableError'

test.describe('isRetryableError', () => {
  test.describe('HTTP status', () => {
    test('408 Request Timeout is retryable', () => {
      assert.equal(isRetryableError({ status: 408 }), true)
    })

    test('425 Too Early is retryable', () => {
      assert.equal(isRetryableError({ status: 425 }), true)
    })

    test('429 Too Many Requests is retryable', () => {
      assert.equal(isRetryableError({ status: 429 }), true)
    })

    test('500 Internal Server Error is retryable', () => {
      assert.equal(isRetryableError({ status: 500 }), true)
    })

    test('503 Service Unavailable is retryable', () => {
      assert.equal(isRetryableError({ status: 503 }), true)
    })

    test('401 Unauthorized is NOT retryable', () => {
      assert.equal(isRetryableError({ status: 401 }), false)
    })

    test('403 Forbidden is NOT retryable', () => {
      assert.equal(isRetryableError({ status: 403 }), false)
    })

    test('400 Bad Request is NOT retryable', () => {
      assert.equal(isRetryableError({ status: 400 }), false)
    })

    test('404 Not Found is NOT retryable', () => {
      assert.equal(isRetryableError({ status: 404 }), false)
    })

    test('reads status from statusCode field', () => {
      assert.equal(isRetryableError({ statusCode: 503 }), true)
      assert.equal(isRetryableError({ statusCode: 401 }), false)
    })

    test('reads status from response.status field', () => {
      assert.equal(isRetryableError({ response: { status: 500 } }), true)
      assert.equal(isRetryableError({ response: { status: 401 } }), false)
    })
  })

  test.describe('network/system error codes', () => {
    test('ECONNRESET is retryable', () => {
      assert.equal(isRetryableError({ code: 'ECONNRESET' }), true)
    })

    test('ETIMEDOUT is retryable', () => {
      assert.equal(isRetryableError({ code: 'ETIMEDOUT' }), true)
    })

    test('ECONNREFUSED is retryable', () => {
      assert.equal(isRetryableError({ code: 'ECONNREFUSED' }), true)
    })

    test('ENOTFOUND is retryable', () => {
      assert.equal(isRetryableError({ code: 'ENOTFOUND' }), true)
    })

    test('UND_ERR_CONNECT_TIMEOUT is retryable', () => {
      assert.equal(isRetryableError({ code: 'UND_ERR_CONNECT_TIMEOUT' }), true)
    })

    test('unknown code is NOT retryable', () => {
      assert.equal(isRetryableError({ code: 'ESOMETHING_WEIRD' }), false)
    })
  })

  test.describe('error names', () => {
    test('AbortError is retryable', () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      assert.equal(isRetryableError(err), true)
    })

    test('TimeoutError is retryable', () => {
      const err = new Error('timeout')
      err.name = 'TimeoutError'
      assert.equal(isRetryableError(err), true)
    })

    test('FetchError is retryable', () => {
      const err = new Error('fetch failed')
      err.name = 'FetchError'
      assert.equal(isRetryableError(err), true)
    })
  })

  test.describe('fallback behavior', () => {
    test('null is retryable (default)', () => {
      assert.equal(isRetryableError(null), true)
    })

    test('undefined is retryable (default)', () => {
      assert.equal(isRetryableError(undefined), true)
    })

    test('string is retryable (default)', () => {
      assert.equal(isRetryableError('something failed'), true)
    })

    test('plain object without classifiable fields is retryable (default)', () => {
      assert.equal(isRetryableError({ message: 'unknown' }), true)
    })

    test('plain Error is retryable (default)', () => {
      assert.equal(isRetryableError(new Error('boom')), true)
    })
  })

  test.describe('precedence', () => {
    test('status takes precedence over code', () => {
      assert.equal(isRetryableError({ status: 401, code: 'ECONNRESET' }), false)
    })
  })
})
