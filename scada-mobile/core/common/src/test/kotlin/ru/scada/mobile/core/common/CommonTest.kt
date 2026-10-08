package ru.scada.mobile.core.common

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SiteCodeTest {
    @Test fun `DEFAULT and blank map to skeet, real codes kept`() {
        assertEquals("skeet", SiteCode.canonical("DEFAULT"))
        assertEquals("skeet", SiteCode.canonical(" default "))
        assertEquals("skeet", SiteCode.canonical(null))
        assertEquals("skeet", SiteCode.canonical(""))
        assertEquals("plant2", SiteCode.canonical("plant2"))
    }
}

class RolesTest {
    @Test fun `line operator sees tasks and production, not receiving or revision`() {
        val a = WmsAccess.of(listOf("line_operator"))
        assertTrue(a.tasks); assertTrue(a.production); assertTrue(a.issue)
        assertFalse(a.receiving); assertFalse(a.revision)
    }

    @Test fun `auditor reads revision but gets no ordinary tasks`() {
        assertFalse(WmsAccess.allowsTaskType(listOf("auditor"), "move"))
        assertTrue(WmsAccess.allowsTaskType(listOf("auditor"), "revision"))
        assertFalse(WmsAccess.allowsTaskType(listOf("line_operator"), "REVISION"))
    }

    @Test fun `no roles mirrors the main WMS legacy behaviour`() {
        val a = WmsAccess.of(emptyList())
        assertFalse(a.tasks); assertFalse(a.revision); assertTrue(a.receiving)
    }

    @Test fun `yms grants are a union of roles`() {
        assertEquals(setOf(YmsPermission.READ, YmsPermission.GATE_CONFIRM), YmsAccess.permissions(listOf("yms_guard")))
        assertEquals(YmsPermission.entries.toSet(), YmsAccess.permissions(listOf("auditor", "warehouse_manager")))
        assertTrue(YmsAccess.permissions(listOf("line_operator")).isEmpty())
    }
}

class Gs1Test {
    private val gs = Gs1.GS

    @Test fun `marking code with separators keeps crypto fields intact`() {
        val raw = "0104607001230011215aB!c%7xYz9Q${gs}91EE07${gs}92dGVzdEJhc2U2NA=="
        val p = Gs1.parse(raw)
        assertEquals("04607001230011", p.gtin)
        assertEquals("5aB!c%7xYz9Q", p.serial)
        assertEquals("EE07", p.elements.first { it.ai == "91" }.value)
        assertEquals("dGVzdEJhc2U2NA==", p.elements.first { it.ai == "92" }.value)
        assertFalse(p.separatorsMissing)
        assertEquals("", p.rest)
    }

    @Test fun `symbology id and leading FNC1 are not part of the data`() {
        val p = Gs1.parse("]d2${gs}0104607001230011215abc${gs}93Ab12")
        assertEquals("04607001230011", p.gtin)
        assertEquals("Ab12", p.elements.last().value)
    }

    @Test fun `without separators the serial is not guessed`() {
        val p = Gs1.parse("010460700123001121ABCDEF9312ab")
        assertEquals("ABCDEF9312ab", p.serial)
        assertTrue(p.separatorsMissing)
    }

    @Test fun `display shows GS but never changes the value sent to API`() {
        val raw = "0104607001230011215abc${gs}93Ab12"
        assertTrue(Gs1.display(raw).contains("⟨GS⟩"))
        assertTrue(raw.contains(gs))
    }

    @Test fun `SSCC and plain barcodes`() {
        assertEquals("046070012300000017", Gs1.parse("00046070012300000017").elements.single().value)
        val ean = Gs1.parse("4607001230011")
        assertTrue(ean.elements.isEmpty())
        assertEquals("4607001230011", ean.rest)
    }
}

class ScanDebouncerTest {
    @Test fun `same code inside the window is dropped`() {
        var t = 0L
        val d = ScanDebouncer(1_000) { t }
        assertTrue(d.accept("A"))
        t = 500; assertFalse(d.accept("A"))
        assertTrue(d.accept("B"))
        t = 5_000; assertTrue(d.accept("A"))
    }
}
