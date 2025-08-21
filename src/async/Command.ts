import { IStorableData, Storable } from "@/core";


export class Command<T extends IStorableData> extends Storable<T> {
  getData() {
    return this.data
  }
}
