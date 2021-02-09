export type Draft<T> = { -readonly [P in keyof T]?: T[P] }

export interface MessageValue<Data> {
  readonly data?: Data
  readonly _id?: number
  readonly kill?: number
}
