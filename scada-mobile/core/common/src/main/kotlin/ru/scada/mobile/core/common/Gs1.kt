package ru.scada.mobile.core.common

/**
 * Разбор GS1 только для ПОКАЗА пользователю. Код, который уходит в API,
 * никогда не пересобирается из разобранных частей: на сервер идёт исходная
 * строка как есть — с настоящим GS (0x1D) и криптохвостом. Нормализацию
 * артефактов сканеров делает backend (`lib/wms/crpt.ts`).
 */
object Gs1 {
    const val GS: Char = '\u001D'

    data class Element(val ai: String, val title: String, val value: String)

    data class Parsed(
        val elements: List<Element>,
        /** В строке не было ни одного GS: длины переменных полей восстановить нельзя. */
        val separatorsMissing: Boolean,
        /** Хвост, который не удалось разобрать (показываем как есть). */
        val rest: String,
    ) {
        val gtin: String? get() = elements.firstOrNull { it.ai == "01" }?.value
        val serial: String? get() = elements.firstOrNull { it.ai == "21" }?.value
        val isMarking: Boolean get() = gtin != null && serial != null
    }

    private data class Spec(val title: String, val fixed: Int?, val max: Int)

    private val SPECS: Map<String, Spec> = mapOf(
        "00" to Spec("SSCC", 18, 18),
        "01" to Spec("GTIN", 14, 14),
        "02" to Spec("GTIN вложения", 14, 14),
        "10" to Spec("Партия", null, 20),
        "11" to Spec("Дата производства", 6, 6),
        "17" to Spec("Годен до", 6, 6),
        "21" to Spec("Серийный номер", null, 20),
        "37" to Spec("Количество", null, 8),
        "91" to Spec("Ключ проверки", null, 90),
        "92" to Spec("Код проверки", null, 90),
        "93" to Spec("Код проверки", null, 90),
        "240" to Spec("Доп. идентификатор", null, 30),
        "8005" to Spec("Цена", 6, 6),
    )

    /** Отрезает идентификатор символики (`]d2`, `]C1`, `]Q3`), если декодер его добавил. */
    fun stripSymbologyId(raw: String): String =
        if (raw.length > 3 && raw[0] == ']' && raw[1].isLetter() && raw[2].isDigit()) raw.substring(3) else raw

    fun parse(raw: String): Parsed {
        val s = stripSymbologyId(raw).trimStart(GS)
        val hasGs = s.indexOf(GS) >= 0
        val out = mutableListOf<Element>()
        var i = 0
        while (i < s.length) {
            if (s[i] == GS) { i++; continue }
            val ai = listOf(4, 3, 2).map { n -> s.substring(i, minOf(s.length, i + n)) }.firstOrNull { it in SPECS && it.all(Char::isDigit) }
                ?: return Parsed(out, !hasGs, s.substring(i))
            val spec = SPECS.getValue(ai)
            val start = i + ai.length
            val end = when {
                spec.fixed != null -> minOf(s.length, start + spec.fixed)
                else -> {
                    val gs = s.indexOf(GS, start)
                    if (gs >= 0) gs else s.length
                }
            }
            if (spec.fixed != null && end - start < spec.fixed) return Parsed(out, !hasGs, s.substring(i))
            out += Element(ai, spec.title, s.substring(start, end))
            i = end
        }
        return Parsed(out, !hasGs && out.any { SPECS[it.ai]?.fixed == null }, "")
    }

    /** Видимое представление разделителя для экрана; в запросы не идёт. */
    fun display(raw: String): String = raw.replace(GS.toString(), "⟨GS⟩")
}
