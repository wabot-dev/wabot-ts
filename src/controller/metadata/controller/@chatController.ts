import { injectable } from "@/injection";
import { IchatControllerConfig } from "./IChatControllerConfig";
import { IConstructor } from "@/shared";


export function chatController(config?: IchatControllerConfig) {
  return function(target: IConstructor<any>){
    injectable()(target)
  }
}

