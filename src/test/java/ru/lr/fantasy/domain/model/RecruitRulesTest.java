package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;
import ru.lr.fantasy.domain.model.building.ClericCastleBuilding;
import ru.lr.fantasy.domain.model.building.MagicCastleBuilding;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class RecruitRulesTest {

    @Test
    public void ordinaryMustBeMultipleOfForty() {
        Land land = landWithBarrackAndFighter();
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 20, 0);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("кратно 40"));
        }
        RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 40, 0);
        assertEquals(1, RecruitRules.slotsRequired(WarriorType.FIGHTER, 40));
        assertEquals(2, RecruitRules.slotsRequired(WarriorType.FIGHTER, 80));
    }

    @Test
    public void siegeOnePerSlot() {
        Land land = landWithBarrackAndFighter();
        land.addAccessBuildWarriorType(WarriorType.CATAPULT);
        RecruitRules.assertCanRecruit(land, WarriorType.CATAPULT, 2, 0);
        assertEquals(2, RecruitRules.slotsRequired(WarriorType.CATAPULT, 2));
    }

    @Test
    public void heroRequiresRaceAccess() {
        Land land = landWithBarrackAndFighter();
        RecruitRules.assertCanRecruit(land, WarriorType.HERO_FIGHTER, 1, 0);
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.HERO_DWARF, 1, 0);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("DWARF"));
        }
    }

    @Test
    public void clericRequiresClericCastle() {
        Land land = new Land(1, 100, "1");
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.CLERIC, 1, 0);
            fail();
        } catch (IllegalStateException ignored) {
        }
        land.addBuilding(new ClericCastleBuilding());
        RecruitRules.assertCanRecruit(land, WarriorType.CLERIC, 1, 0);
        assertEquals(5, RecruitRules.turnCountFor(WarriorType.CLERIC));
    }

    @Test
    public void oneBarrackGivesThreeSlots() {
        Land land = landWithBarrackAndFighter();
        assertEquals(3, RecruitRules.barrackSlotCapacity(land.getBuildings()));
        assertEquals(RecruitRules.SLOTS_PER_BARRACK, 3);
        RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 120, 0); // 3 slots
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 160, 0);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("слотов"));
        }
    }

    @Test
    public void pendingSlotsReduceCapacity() {
        Land land = landWithBarrackAndFighter();
        // 1 barrack = 3 slots; 2 pending → 1 free → max 40 fighters
        try {
            RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 80, 2);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("слотов"));
        }
        RecruitRules.assertCanRecruit(land, WarriorType.FIGHTER, 40, 2);
    }

    @Test
    public void magicPoolSeparate() {
        Land land = landWithBarrackAndFighter();
        land.addBuilding(new MagicCastleBuilding());
        RecruitRules.assertCanRecruit(land, WarriorType.MAGIC, 1, 0);
        assertEquals(RecruitRules.SlotPool.MAGIC, RecruitRules.poolFor(WarriorType.MAGIC));
    }

    private static Land landWithBarrackAndFighter() {
        Land land = new Land(1, 100, "1");
        land.addAccessBuildWarriorType(WarriorType.FIGHTER);
        land.addBuilding(new BarrackBuilding());
        return land;
    }
}
