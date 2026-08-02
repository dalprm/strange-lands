package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class RecruitGoldTest {

    @Test
    public void cannotRecruitWithoutGoldButSlotsOk() {
        Player dal = new Player(1, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(3, 3);
        Land land = world.getPlayerLands(dal).get(0);
        world.getPlayerWorldResources().get(1L).setGold(100);
        try {
            EconomyRules.spendGold(world, 1L, EconomyRules.goldCostForRecruit(WarriorType.FIGHTER, 40));
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("Недостаточно золота"));
        }
        assertEquals(0, world.getTurn().pendingRecruitSlots(land, RecruitRules.SlotPool.BARRACK));
        assertEquals(100L, world.getPlayerWorldResources().get(1L).getGold());
    }

    @Test
    public void renamedTypesStillRecruitable() {
        Land land = new Land(1, 100, "1");
        land.addAccessBuildWarriorType(WarriorType.HOBBIT);
        land.addAccessBuildWarriorType(WarriorType.SHADOW_ELF);
        land.addAccessBuildWarriorType(WarriorType.BALLISTA);
        land.addBuilding(new BarrackBuilding());
        RecruitRules.assertCanRecruit(land, WarriorType.HOBBIT, 40, 0);
        RecruitRules.assertCanRecruit(land, WarriorType.SHADOW_ELF, 40, 0);
        RecruitRules.assertCanRecruit(land, WarriorType.BALLISTA, 1, 0);
        assertEquals(400L, EconomyRules.goldCostPerRecruitQuantum(WarriorType.HOBBIT));
        assertEquals(1_500L, EconomyRules.goldCostPerRecruitQuantum(WarriorType.SHADOW_ELF));
        assertEquals(1_500L, EconomyRules.goldCostPerRecruitQuantum(WarriorType.BALLISTA));
    }
}
