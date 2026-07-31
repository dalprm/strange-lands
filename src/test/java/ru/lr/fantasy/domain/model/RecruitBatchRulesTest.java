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
        land.addBuilding(new BarrackBuilding()); // 6 slots

        int pending = 0;
        RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 80, pending); // 2 slots
        pending += RecruitRules.slotsRequired(WarriorType.FIGHTER, 80);
        RecruitRules.assertCanRecruit(land, WarriorType.CATAPULT, 2, pending); // +2
        pending += RecruitRules.slotsRequired(WarriorType.CATAPULT, 2);
        assertEquals(4, pending);
    }

    @Test
    public void overfillRejectedBeforeAnyQueue() {
        Player dal = new Player(1, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(3, 3);
        Land land = world.getPlayerLands(dal).get(0);
        // 2 barracks = 12 slots; try 13 catapults worth after filling
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.CATAPULT, 13, 0);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("слотов"));
        }
        assertEquals(0, world.getTurn().pendingRecruitSlots(land, RecruitRules.SlotPool.BARRACK));
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
