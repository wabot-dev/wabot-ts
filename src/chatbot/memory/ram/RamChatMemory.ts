
import { IChatItem } from "../../IChatItem";
import { IChatMemory } from "../IChatMemory";

export class RamChatMemory implements IChatMemory {
  private memory: IChatItem[] = [];

  async findLastItems(count: number): Promise<IChatItem[]> {
    return this.memory.slice(-count);
  }

  async saveItem(item: IChatItem): Promise<void> {
    this.memory.push(item);
  }
  
  async clearMemory(): Promise<void> {
    this.memory = [];
  }
}