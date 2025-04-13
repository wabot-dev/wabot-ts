import { IContext } from "./IContext";

export abstract class  Context implements IContext {
  getPersonId(): Promise<string | null> {
    throw new Error("Method not implemented.");
  }
}