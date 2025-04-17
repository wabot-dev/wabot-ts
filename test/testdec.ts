import 'reflect-metadata'

function classDecorator() {
  return function (target: any) {
  
  }
}

function methodDecorator() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {

  }
}

function paramDecorator() {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    console.log("Property key:", propertyKey)
  }
}

@classDecorator()
class MyClass {

  constructor(private name: string, private age: number) {}
  
  @methodDecorator()
  myMethod(@paramDecorator() param1: string): string {
    return 'Hello, world!'
  }
}

const constructorTypes = Reflect.getMetadata('design:paramtypes', MyClass)
const paramsTypes = Reflect.getMetadata('design:paramtypes', MyClass.prototype, 'myMethod')
const returnType = Reflect.getMetadata('design:returntype', MyClass.prototype, 'myMethod')

console.log()
console.log('Constructor types:', constructorTypes)
console.log('Parameter types:', paramsTypes)
console.log('Return type:', returnType)