import { IMindset } from "@/mindset";
import { IConstructor } from "@/shared";

export interface IChatBotMetadata {
  constructor: IConstructor<any>
  mindsetConstructor: IConstructor<IMindset>
  injectionToken: string
}