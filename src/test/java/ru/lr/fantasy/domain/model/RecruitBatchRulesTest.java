package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.application.port.in.LandUseCase.RecruitBatchItem;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

/** Проверка атомарности правил batch на уровне RecruitRules + Turn. */
public class RecruitBatchRulesTest {

    @Test
    public void collapsedBatchFitsSlots() {
        Land land = new Land(1, 100, "1");
        land.addAccessBuildWarriorType(WarriorType.FIGHTER);
        land.addAccessBuildWarriorType(WarriorType.CATAPULT);
        land.addBuilding(new BarrackBuilding()); // 3 slots

        int pending = 0;
        RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 40, pending); // 1 slot
        pending += RecruitRules.slotsRequired(WarriorType.FIGHTER, 40);
        RecruitRules.assertCanRecruit(land, WarriorType.CATAPULT, 2, pending); // +2
        pending += RecruitRules.slotsRequired(WarriorType.CATAPULT, 2);
        assertEquals(3, pending);
    }

    @Test
    public void overfillRejectedBeforeAnyQueue() {
        Land land = new Land(1, 100, "1");
        land.addAccessBuildWarriorType(WarriorType.CATAPULT);
        land.addBuilding(new BarrackBuilding()); // 3 slots
        int cap = RecruitRules.barrackSlotCapacity(land.getBuildings());
        assertEquals(3, cap);
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.CATAPULT, cap + 1, 0);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("слотов"));
        }
    }

    @Test
    public void batchItemsRecordShape() {
        List<RecruitBatchItem> items = List.of(
                new RecruitBatchItem(WarriorType.FIGHTER, 80),
                new RecruitBatchItem(WarriorType.TARAN, 1));
        assertEquals(2, items.size());
        assertEquals(WarriorType.FIGHTER, items.get(0).warriorType());
        assertEquals(80, items.get(0).count());
    }
}
