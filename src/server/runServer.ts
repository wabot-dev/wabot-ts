import dotenv from 'dotenv'
dotenv.config()

import { IChatRepository } from "@/chatbot";
import { IConstructor } from "@/shared";

export interface IServerConfig {
  controllers: IConstructor<any>[]
  chatRepository?: IConstructor<IChatRepository>
}

export function runServer(config: IServerConfig) {

}