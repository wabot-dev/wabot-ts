import test from 'node:test'
import assert from 'node:assert/strict'
import { UiControllerMetadataStore } from './UiControllerMetadataStore'

function createStore() {
  return new UiControllerMetadataStore()
}

test.describe('UiControllerMetadataStore', () => {
  test('registra y obtiene vistas de un controlador', () => {
    const store = createStore()
    class MyController {}

    store.saveControllerMetadata({
      controllerConstructor: MyController,
      path: '/my/ui',
      middlewares: [],
    })
    store.saveViewMetadata({
      controllerConstructor: MyController,
      functionName: 'index',
      paramsTypes: [],
    })

    const views = store.getControllerViewsInfo(MyController)
    assert.equal(views.length, 1)
    assert.equal(views[0].functionName, 'index')
    assert.equal(views[0].controller.path, '/my/ui')
    assert.deepEqual(views[0].middlewares, [])
  })

  test('registra y obtiene acciones de un controlador', () => {
    const store = createStore()
    class MyController {}

    store.saveControllerMetadata({
      controllerConstructor: MyController,
      path: '/my/ui',
      middlewares: [],
    })
    store.saveActionMetadata({
      controllerConstructor: MyController,
      functionName: 'addTodo',
      paramsTypes: [String],
    })

    const actions = store.getControllerActionsInfo(MyController)
    assert.equal(actions.length, 1)
    assert.equal(actions[0].functionName, 'addTodo')
    assert.deepEqual(actions[0].paramsTypes, [String])
  })

  test('lanza error si el controlador no esta decorado', () => {
    const store = createStore()
    class NotDecorated {}

    assert.throws(() => store.getControllerViewsInfo(NotDecorated), {
      message: 'NotDecorated should be decorated with @uiController',
    })
  })

  test('retorna array vacio si no hay vistas', () => {
    const store = createStore()
    class EmptyController {}

    store.saveControllerMetadata({
      controllerConstructor: EmptyController,
      path: '/empty',
      middlewares: [],
    })

    assert.equal(store.getControllerViewsInfo(EmptyController).length, 0)
  })

  test('hereda vistas de la clase padre', () => {
    const store = createStore()
    class BaseController {}
    class ChildController extends BaseController {}

    store.saveViewMetadata({
      controllerConstructor: BaseController,
      functionName: 'index',
      paramsTypes: [],
    })
    store.saveControllerMetadata({
      controllerConstructor: ChildController,
      path: '/child',
      middlewares: [],
    })

    const views = store.getControllerViewsInfo(ChildController)
    assert.equal(views.length, 1)
    assert.equal(views[0].functionName, 'index')
    assert.equal(views[0].controllerConstructor, ChildController)
    assert.equal(views[0].controller.path, '/child')
  })

  test('hereda middlewares de metodo de la clase padre', () => {
    const store = createStore()
    class BaseController {}
    class ChildController extends BaseController {}
    class AuthGuard {
      async handle() {}
    }

    store.saveViewMetadata({
      controllerConstructor: BaseController,
      functionName: 'index',
      paramsTypes: [],
    })
    store.saveMiddlewareMetadata({
      controllerConstructor: BaseController,
      functionName: 'index',
      middlewareConstructor: AuthGuard as any,
    })
    store.saveControllerMetadata({
      controllerConstructor: ChildController,
      path: '/child',
      middlewares: [],
    })

    const views = store.getControllerViewsInfo(ChildController)
    assert.equal(views[0].middlewares.length, 1)
    assert.equal(views[0].middlewares[0].middlewareConstructor, AuthGuard)
  })

  test('expone los middlewares declarados a nivel de controlador', () => {
    const store = createStore()
    class MyController {}
    class AuthGuard {
      async handle() {}
    }

    store.saveControllerMetadata({
      controllerConstructor: MyController,
      path: '/admin',
      middlewares: [AuthGuard as any],
    })
    store.saveViewMetadata({
      controllerConstructor: MyController,
      functionName: 'index',
      paramsTypes: [],
    })

    const views = store.getControllerViewsInfo(MyController)
    assert.deepEqual(views[0].controller.middlewares, [AuthGuard])
  })
})
