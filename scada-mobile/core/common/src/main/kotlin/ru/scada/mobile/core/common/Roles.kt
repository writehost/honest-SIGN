package ru.scada.mobile.core.common

/**
 * Доступ к разделам по `roleCodes`. Перенос правил основного WMS:
 *  - `lib/mobile-permissions.ts`               — разделы мобильного ТСД;
 *  - `lib/wms/device-operator-auth.ts`         — какие типы заданий видит оператор;
 *  - `lib/wms/yms/permissions.ts` (ROLE_GRANTS) — права YMS.
 * Это только подсказка интерфейсу: окончательно права проверяет backend.
 */
data class WmsAccess(
    val tasks: Boolean,
    val revision: Boolean,
    val scan: Boolean,
    val receiving: Boolean,
    val issue: Boolean,
    val virtualWarehouse: Boolean,
    val production: Boolean,
) {
    companion object {
        private val TASKS = setOf("admin", "warehouse_manager", "warehouse_operator", "line_operator")
        private val REVISION = setOf("admin", "warehouse_manager", "warehouse_operator", "auditor")
        private val RECEIVING = setOf("admin", "warehouse_manager", "warehouse_operator")
        private val ISSUE = setOf("admin", "warehouse_manager", "warehouse_operator", "line_operator")
        private val VIRTUAL = setOf("admin", "warehouse_manager", "warehouse_operator", "auditor")
        private val PRODUCTION = setOf("admin", "warehouse_manager", "line_operator")

        fun of(roleCodes: Collection<String>): WmsAccess {
            val codes = roleCodes.map { it.trim() }.filter { it.isNotEmpty() }.toSet()
            // Пользователь без ролей (старый вход) — как в основном WMS: всё, кроме заданий и ревизии.
            if (codes.isEmpty()) {
                return WmsAccess(tasks = false, revision = false, scan = true, receiving = true, issue = true, virtualWarehouse = true, production = true)
            }
            return WmsAccess(
                tasks = codes.any { it in TASKS },
                revision = codes.any { it in REVISION },
                scan = true,
                receiving = codes.any { it in RECEIVING },
                issue = codes.any { it in ISSUE },
                virtualWarehouse = codes.any { it in VIRTUAL },
                production = codes.any { it in PRODUCTION },
            )
        }

        /** `roleCodesAllowTaskType`: ревизию видят роли ревизии, остальные задания — роли заданий. */
        fun allowsTaskType(roleCodes: Collection<String>, taskType: String): Boolean {
            val codes = roleCodes.map { it.trim() }.toSet()
            return if (taskType.trim().equals("revision", ignoreCase = true)) codes.any { it in REVISION }
            else codes.any { it in TASKS }
        }
    }
}

enum class YmsPermission(val code: String) {
    READ("yms.read"),
    VISIT_WRITE("yms.visit.write"),
    ASSIGN("yms.assign"),
    GATE_CONFIRM("yms.gate.confirm"),
    WAREHOUSE_CONFIRM("yms.warehouse.confirm"),
    YARD_WRITE("yms.yard.write"),
}

object YmsAccess {
    private val ALL = YmsPermission.entries.toSet()
    private val GRANTS: Map<String, Set<YmsPermission>> = mapOf(
        "admin" to ALL,
        "warehouse_manager" to ALL,
        "warehouse_operator" to setOf(YmsPermission.READ, YmsPermission.WAREHOUSE_CONFIRM),
        "auditor" to setOf(YmsPermission.READ),
        "yms_dispatcher" to setOf(YmsPermission.READ, YmsPermission.VISIT_WRITE, YmsPermission.ASSIGN, YmsPermission.YARD_WRITE, YmsPermission.GATE_CONFIRM),
        "dispatcher" to setOf(YmsPermission.READ, YmsPermission.VISIT_WRITE, YmsPermission.ASSIGN, YmsPermission.YARD_WRITE, YmsPermission.GATE_CONFIRM),
        "yms_guard" to setOf(YmsPermission.READ, YmsPermission.GATE_CONFIRM),
        "guard" to setOf(YmsPermission.READ, YmsPermission.GATE_CONFIRM),
        "yms_logist" to setOf(YmsPermission.READ, YmsPermission.VISIT_WRITE),
        "logist" to setOf(YmsPermission.READ, YmsPermission.VISIT_WRITE),
        "yms_warehouse" to setOf(YmsPermission.READ, YmsPermission.WAREHOUSE_CONFIRM),
    )

    fun permissions(roleCodes: Collection<String>): Set<YmsPermission> =
        roleCodes.flatMap { GRANTS[it.trim()].orEmpty() }.toSet()
}
