import { container, injectable } from "@/injection";
import { IchatControllerConfig } from "./IChatControllerConfig";
import { IConstructor } from "@/shared";
import { ControllerMetadataStore } from "../ControllerMetadataStore";


export function chatController(config?: IchatControllerConfig) {
  return function(target: IConstructor<any>){
    const controllerMetaDataStore = container.resolve(ControllerMetadataStore)
    controllerMetaDataStore.saveChatControllerMetadata({
      controllerConstructor: target,
    })
    injectable()(target)
  }
}

