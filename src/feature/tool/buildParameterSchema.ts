import {
  IModelValidatorsInfo,
  IPropertyValidatorInfo,
  IValidateArrayOptionsWithItemsValidators,
  validateArray,
  validateModel,
} from '@/core/validation'
import { validateIsBoolean } from '@/core/validation/validators/is-boolean/validateIsBoolean'
import { validateIsDate } from '@/core/validation/validators/is-date/validateIsDate'
import { validateIsIn } from '@/core/validation/validators/is-in/validateIsIn'
import { validateIsNotEmpty } from '@/core/validation/validators/is-not-empty/validateIsNotEmpty'
import { validateIsNumber } from '@/core/validation/validators/is-number/validateIsNumber'
import { validateIsRecord } from '@/core/validation/validators/is-record/validateIsRecord'
import { validateIsString } from '@/core/validation/validators/is-string/validateIsString'
import { validateMax } from '@/core/validation/validators/max/validateMax'
import { validateMin } from '@/core/validation/validators/min/validateMin'
import { DescriptionMetadataStore } from '@/core/description'
import { IToolParameterSchema } from './IToolSchema'

export interface IBuildSchemaDeps {
  descriptionStore: DescriptionMetadataStore
}

export function buildPropertySchema(
  validators: IPropertyValidatorInfo[],
  description: string | undefined,
  deps: IBuildSchemaDeps,
): IToolParameterSchema {
  const schema: IToolParameterSchema = { type: 'string' }
  if (description) schema.description = description

  let typeAssigned = false

  for (const v of validators) {
    const { validator, validatorOptions } = v
    if (validator === validateIsString) {
      schema.type = 'string'
      typeAssigned = true
    } else if (validator === validateIsNumber) {
      schema.type = 'number'
      typeAssigned = true
    } else if (validator === validateIsBoolean) {
      schema.type = 'boolean'
      typeAssigned = true
    } else if (validator === validateIsDate) {
      schema.type = 'string'
      schema.format = 'date-time'
      typeAssigned = true
    } else if (validator === validateArray) {
      schema.type = 'array'
      typeAssigned = true
      const arrOpts = validatorOptions as IValidateArrayOptionsWithItemsValidators | undefined
      if (arrOpts?.minLength != null) schema.minItems = arrOpts.minLength
      if (arrOpts?.maxLength != null) schema.maxItems = arrOpts.maxLength
      if (arrOpts?.itemsValidator && arrOpts.itemsValidator.length > 0) {
        const itemValidatorInfos: IPropertyValidatorInfo[] = arrOpts.itemsValidator.map(
          (iv, idx) => ({
            propertyName: `__item_${idx}`,
            validator: iv.validator,
            validatorOptions: iv.options,
          }),
        )
        schema.items = buildPropertySchema(itemValidatorInfos, undefined, deps)
      } else {
        schema.items = { type: 'string' }
      }
    } else if (validator === validateModel) {
      const modelInfo = validatorOptions as IModelValidatorsInfo<any> | undefined
      schema.type = 'object'
      typeAssigned = true
      if (modelInfo) {
        const built = buildModelSchema(modelInfo, deps)
        schema.properties = built.properties
        if (built.required && built.required.length > 0) {
          schema.required = built.required
        }
        schema.additionalProperties = false
      }
    } else if (validator === validateIsRecord) {
      schema.type = 'object'
      typeAssigned = true
      const opts = validatorOptions as { keyType: string; valueType: string } | undefined
      if (opts) {
        schema.additionalProperties = { type: opts.valueType as any }
      }
    } else if (validator === validateIsIn) {
      const opts = validatorOptions as
        | { values: readonly (string | number | boolean | null)[] }
        | undefined
      if (opts) {
        schema.enum = [...opts.values]
        if (!typeAssigned) {
          const sample = opts.values.find((x) => x != null)
          const t = typeof sample
          if (t === 'string' || t === 'number' || t === 'boolean') {
            schema.type = t as any
            typeAssigned = true
          }
        }
      }
    } else if (validator === validateMin) {
      const opts = validatorOptions as { limit: any } | undefined
      const limit = opts && Number(opts.limit)
      if (limit != null && !Number.isNaN(limit)) {
        if (schema.type === 'string') {
          schema.minLength = limit
        } else if (schema.type === 'array') {
          schema.minItems = limit
        } else {
          schema.minimum = limit
        }
      }
    } else if (validator === validateMax) {
      const opts = validatorOptions as { limit: any } | undefined
      const limit = opts && Number(opts.limit)
      if (limit != null && !Number.isNaN(limit)) {
        if (schema.type === 'string') {
          schema.maxLength = limit
        } else if (schema.type === 'array') {
          schema.maxItems = limit
        } else {
          schema.maximum = limit
        }
      }
    } else if (validator === validateIsNotEmpty) {
      if (schema.type === 'array') {
        if (schema.minItems == null || schema.minItems < 1) schema.minItems = 1
      } else {
        if (schema.minLength == null || schema.minLength < 1) schema.minLength = 1
      }
    }
  }

  return schema
}

export function buildModelSchema(
  modelInfo: IModelValidatorsInfo<any>,
  deps: IBuildSchemaDeps,
): { properties: Record<string, IToolParameterSchema>; required: string[] } {
  const properties: Record<string, IToolParameterSchema> = {}
  const required: string[] = []

  const descriptions = deps.descriptionStore.getModelDescriptions(modelInfo.modelConstructor)
  const descByName = new Map(descriptions.map((d) => [d.propertyName, d]))

  for (const propertyName in modelInfo.properties) {
    const propInfo = modelInfo.properties[propertyName]
    if (!propInfo) continue
    const desc = descByName.get(propertyName)?.description
    const schema = buildPropertySchema(propInfo.validators ?? [], desc, deps)
    properties[propertyName] = schema
    if (!propInfo.isOptional) required.push(propertyName)
  }

  return { properties, required }
}
