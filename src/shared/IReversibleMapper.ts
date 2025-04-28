export interface IReversibleMapper<T1, T2> {
  map(input: T1): T2
  rev(input: T2): T1
}
