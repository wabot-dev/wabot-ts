import test from 'node:test'
import assert from 'node:assert/strict'
import { RestControllerMetadataStore } from './RestControllerMetadataStore'

function createStore() {
  return new RestControllerMetadataStore()
}

test.describe('RestControllerMetadataStore', () => {
  test('registra y obtiene endpoints de un controlador', () => {
    const store = createStore()
    class MyController {}

    store.saveControllerMetadata({ controllerConstructor: MyController, path: '/api' })
    store.saveEndPointMetadata({
      controllerConstructor: MyController,
      method: 'get',
      functionName: 'list',
      paramsTypes: [],
    })

    const endpoints = store.getControllerEndPointsInfo(MyController)
    assert.equal(endpoints.length, 1)
    assert.equal(endpoints[0].functionName, 'list')
    assert.equal(endpoints[0].method, 'get')
    assert.equal(endpoints[0].controller.path, '/api')
  })

  test('lanza error si el controlador no esta decorado', () => {
    const store = createStore()
    class NotDecorated {}

    assert.throws(() => store.getControllerEndPointsInfo(NotDecorated), {
      message: 'NotDecorated should be decorated with @restController',
    })
  })

  test('retorna array vacio si no hay endpoints', () => {
    const store = createStore()
    class EmptyController {}

    store.saveControllerMetadata({ controllerConstructor: EmptyController, path: '/empty' })

    const endpoints = store.getControllerEndPointsInfo(EmptyController)
    assert.equal(endpoints.length, 0)
  })

  test('hereda endpoints de la clase padre', () => {
    const store = createStore()
    class BaseController {}
    class ChildController extends BaseController {}

    store.saveEndPointMetadata({
      controllerConstructor: BaseController,
      method: 'post',
      functionName: 'handleWebhook',
      paramsTypes: [],
      config: { disableJsonParser: true },
    })
    store.saveControllerMetadata({ controllerConstructor: ChildController, path: '/webhook' })

    const endpoints = store.getControllerEndPointsInfo(ChildController)
    assert.equal(endpoints.length, 1)
    assert.equal(endpoints[0].functionName, 'handleWebhook')
    assert.equal(endpoints[0].method, 'post')
    assert.equal(endpoints[0].controllerConstructor, ChildController)
    assert.equal(endpoints[0].controller.path, '/webhook')
  })

  test('el hijo puede sobreescribir un endpoint del padre', () => {
    const store = createStore()
    class BaseController {}
    class ChildController extends BaseController {}

    store.saveEndPointMetadata({
      controllerConstructor: BaseController,
      method: 'get',
      functionName: 'list',
      paramsTypes: [],
    })
    store.saveEndPointMetadata({
      controllerConstructor: ChildController,
      method: 'post',
      functionName: 'list',
      paramsTypes: [String],
    })
    store.saveControllerMetadata({ controllerConstructor: ChildController, path: '/child' })

    const endpoints = store.getControllerEndPointsInfo(ChildController)
    assert.equal(endpoints.length, 1)
    assert.equal(endpoints[0].method, 'post')
    assert.deepEqual(endpoints[0].paramsTypes, [String])
  })

  test('hereda middlewares de la clase padre', () => {
    const store = createStore()
    class BaseController {}
    class ChildController extends BaseController {}
    class AuthMiddleware {
      async handle() {}
    }

    store.saveEndPointMetadata({
      controllerConstructor: BaseController,
      method: 'get',
      functionName: 'list',
      paramsTypes: [],
    })
    store.saveMiddlewareMetadata({
      controllerConstructor: BaseController,
      functionName: 'list',
      middlewareConstructor: AuthMiddleware as any,
    })
    store.saveControllerMetadata({ controllerConstructor: ChildController, path: '/child' })

    const endpoints = store.getControllerEndPointsInfo(ChildController)
    assert.equal(endpoints[0].middlewares.length, 1)
    assert.equal(endpoints[0].middlewares[0].middlewareConstructor, AuthMiddleware)
  })

  test('multiples clases hijas tienen endpoints independientes', () => {
    const store = createStore()
    class BaseController {}
    class ChildA extends BaseController {}
    class ChildB extends BaseController {}

    store.saveEndPointMetadata({
      controllerConstructor: BaseController,
      method: 'post',
      functionName: 'handle',
      paramsTypes: [],
    })
    store.saveControllerMetadata({ controllerConstructor: ChildA, path: '/a' })
    store.saveControllerMetadata({ controllerConstructor: ChildB, path: '/b' })

    const endpointsA = store.getControllerEndPointsInfo(ChildA)
    const endpointsB = store.getControllerEndPointsInfo(ChildB)

    assert.equal(endpointsA[0].controller.path, '/a')
    assert.equal(endpointsA[0].controllerConstructor, ChildA)
    assert.equal(endpointsB[0].controller.path, '/b')
    assert.equal(endpointsB[0].controllerConstructor, ChildB)
  })
})
