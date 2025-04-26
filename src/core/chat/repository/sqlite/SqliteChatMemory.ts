import type { IChatItem } from "../../IChatItem";
import type { IChatMemory } from "../IChatMemory";

export class SqliteChatMemory implements IChatMemory {
 
  constructor(private chatId: string) {

    
  }
  
  
  findLastItems(count: number): Promise<IChatItem[]> {
    throw new Error("Method not implemented.");
  }

  saveItem(item: IChatItem): Promise<void> {
    throw new Error("Method not implemented.");
  }

}