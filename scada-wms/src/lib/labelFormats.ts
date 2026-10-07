export type LabelFormat = 'thermal58x40' | 'thermal58x30' | 'a4'

export const LABEL_FORMATS: Record<LabelFormat, { name: string; hint: string }> = {
  thermal58x40: { name: '58 × 40 мм', hint: 'Термопринтер (Xprinter, Godex) — тот же, что для этикеток WB/Ozon' },
  thermal58x30: { name: '58 × 30 мм', hint: 'Узкая этикетка на полку' },
  a4: { name: 'A4, 3 × 8', hint: 'Обычный принтер, самоклеящаяся бумага 70 × 37 мм' },
}
