import { singleton } from '@/injection'
import { IMindsetFunctionDecoration } from './functions/IMindsetFunctionDecoration'

import {
  IMindsetFunctionMetadata,
  IMindsetFunctionParamMetadata,
  IMindsetMetadata,
  IMindsetModuleMetadata,
} from './IMindsetMetadata'
import { IMindsetModuleDecoration } from './modules/IMindsetModuleDecoration'
import { IParamDecoration } from './params/IParamDecoration'

import { IConstructor } from '@/shared'
import { IMindset } from '../IMindset'

import { MINDSET_FUNCTION_DECORATION_FUNCTION } from './functions/decoratorNames'
import { IMindsetDecoration } from './mindsets/IMindsetDecoration'
import { MINDSET_DECORATION_MINDSET } from './mindsets/decoratorNames'
import { MINDSET_MODULE_DECORATION_MODULE } from './modules/decoratorNames'

@singleton()
export class MindsetMetadataStore {
  private readonly paramsDecorations = new Map<Function, Map<string, IParamDecoration[]>>()
  private readonly functionsDecorations = new Map<
    Function,
    Map<string, IMindsetFunctionDecoration[]>
  >()
  private readonly modulesDecorations = new Map<Function, IMindsetModuleDecoration[]>()
  private readonly mindsetsDecorations = new Map<Function, IMindsetDecoration[]>()

  public saveParamDecoration(paramDecoration: IParamDecoration): void {
    let paramsMap = this.paramsDecorations.get(paramDecoration.constructor)
    if (!paramsMap) {
      paramsMap = new Map<string, IParamDecoration[]>()
      this.paramsDecorations.set(paramDecoration.constructor, paramsMap)
    }
    let decorations = paramsMap.get(paramDecoration.paramName)
    if (!decorations) {
      decorations = []
      paramsMap.set(paramDecoration.paramName, decorations)
    }
    decorations.push(paramDecoration)
  }

  public saveFunctionDecoration(functionDecoration: IMindsetFunctionDecoration) {
    let functionsMap = this.functionsDecorations.get(functionDecoration.constructor)
    if (!functionsMap) {
      functionsMap = new Map<string, IMindsetFunctionDecoration[]>()
      this.functionsDecorations.set(functionDecoration.constructor, functionsMap)
    }
    let decorations = functionsMap.get(functionDecoration.functionName)
    if (!decorations) {
      decorations = []
      functionsMap.set(functionDecoration.functionName, decorations)
    }
    decorations.push(functionDecoration)
  }

  public saveModuleDecoration(moduleDecoration: IMindsetModuleDecoration): void {
    let modulesDecorations = this.modulesDecorations.get(moduleDecoration.constructor)
    if (!modulesDecorations) {
      modulesDecorations = []
      this.modulesDecorations.set(moduleDecoration.constructor, modulesDecorations)
    }
    modulesDecorations.push(moduleDecoration)
  }

  public saveMindsetDecoration(mindsetDecoration: IMindsetDecoration): void {
    let mindsetsDecorations = this.mindsetsDecorations.get(mindsetDecoration.constructor)
    if (!mindsetsDecorations) {
      mindsetsDecorations = []
      this.mindsetsDecorations.set(mindsetDecoration.constructor, mindsetsDecorations)
    }
    mindsetsDecorations.push(mindsetDecoration)
  }

  public getRequestParamsMetadata(requestConstructor: Function): IMindsetFunctionParamMetadata[] {
    const paramsMap = this.paramsDecorations.get(requestConstructor)
    if (!paramsMap) {
      return []
    }

    const paramsMetadata: IMindsetFunctionParamMetadata[] = []
    paramsMap.forEach((decorations, paramName) => {
      const paramMainDecoration = decorations.find((decoration) => decoration.decorationConfig)
      if (!paramMainDecoration) {
        return
      }

      paramsMetadata.push({
        config: paramMainDecoration.decorationConfig!,
        name: paramName,
        type: paramMainDecoration.paramType,
      })
      // TODO: add support for validation decorators
    })

    return paramsMetadata
  }

  public getFunctionsMetadata(moduleConstructor: Function): IMindsetFunctionMetadata[] {
    const functionsMap = this.functionsDecorations.get(moduleConstructor)
    if (!functionsMap) {
      return []
    }

    const functionsMetadata: IMindsetFunctionMetadata[] = []
    functionsMap.forEach((decorations) => {
      const mainDecoration = decorations.find(
        (decoration) => decoration.decorationName === MINDSET_FUNCTION_DECORATION_FUNCTION,
      )
      if (!mainDecoration) {
        return
      }

      functionsMetadata.push({
        moduleConstructor: mainDecoration.constructor,
        config: mainDecoration.decorationConfig,
        name: mainDecoration.functionName,
        requestConstructor: mainDecoration.paramsTypes[0],
        params: mainDecoration.paramsTypes[0]
          ? this.getRequestParamsMetadata(mainDecoration.paramsTypes[0])
          : [],
      })
    })
    return functionsMetadata
  }

  public getModuleMetadata(moduleConstructor: Function): IMindsetModuleMetadata {
    const decorations = this.modulesDecorations.get(moduleConstructor)
    if (!decorations) {
      throw new Error(`Module ${moduleConstructor.name} not found`)
    }

    const mainDecoration = decorations.find(
      (decoration) => decoration.decorationName === MINDSET_MODULE_DECORATION_MODULE,
    )
    if (!mainDecoration) {
      throw new Error(`Module ${moduleConstructor.name} not found`)
    }

    return {
      constructor: moduleConstructor,
      config: mainDecoration.decorationConfig,
      functions: this.getFunctionsMetadata(moduleConstructor),
    }
  }

  public getMindsetMetadata(ctor: Function): IMindsetMetadata {
    const decorations = this.mindsetsDecorations.get(ctor)
    if (!decorations) {
      throw new Error(`Mindset ${ctor.name} not found`)
    }

    const mainDecoration = decorations.find(
      (decoration) => decoration.decorationName === MINDSET_DECORATION_MINDSET,
    )
    if (!mainDecoration) {
      throw new Error(`Mindset ${ctor.name} not found`)
    }

    return {
      constructor: ctor as any,
      config: mainDecoration.decorationConfig,
      modules: mainDecoration.decorationConfig.modules
        ? mainDecoration.decorationConfig.modules.map((module: Function) =>
            this.getModuleMetadata(module),
          )
        : [],
    }
  }
}
