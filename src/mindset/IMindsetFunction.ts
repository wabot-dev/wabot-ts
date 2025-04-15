export type IMindsetFunctionParams = {}

export interface IMindsetFunction<P extends IMindsetFunctionParams> {
  execute(params: P): Promise<string>
}
