import test from 'node:test'
import assert from 'node:assert/strict'
import { Password } from './Password'

test.describe('Password', () => {
  test('Hash y validación con contraseña válida', () => {
    const password = 'MiClaveSegura!'
    const hash = Password.hash({ password: password })
    const isValid = Password.isValid({ password, hash })
    assert.equal(isValid, true, 'La contraseña debería ser válida')
  })

  test('Validación con contraseña incorrecta', () => {
    const password = 'Correcta'
    const wrongPassword = 'Incorrecta'
    const hash = Password.hash({ password })
    const isValid = Password.isValid({ password: wrongPassword, hash })
    assert.equal(isValid, false, 'La contraseña incorrecta no debe validarse')
  })

  test('Hash y validación con diferentes longitudes de sal y clave', () => {
    const password = 'ConSalYLlavePersonalizada'
    const hash = Password.hash({
      password: password,
      saltLength: 32,
      keyLength: 128,
    })
    const isValid = Password.isValid({ password, hash })
    assert.equal(isValid, true, 'Debería validar con sal y clave personalizada')
  })

  test('Validación con hash malformado (sin ":")', () => {
    const result = Password.isValid({
      password: 'algo',
      hash: 'hashmalformado',
    })
    assert.equal(result, false, 'Debe fallar si el hash no tiene formato válido')
  })

  test('Validación con hash incompleto (sin clave)', () => {
    const result = Password.isValid({
      password: 'algo',
      hash: 'soloelsalt:',
    })
    assert.equal(result, false, 'Debe fallar si falta la clave en el hash')
  })
})
