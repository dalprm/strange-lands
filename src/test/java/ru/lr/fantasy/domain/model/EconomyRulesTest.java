package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;
import ru.lr.fantasy.domain.model.building.CastleBuilding;
import ru.lr.fantasy.domain.model.building.ClericCastleBuilding;
import ru.lr.fantasy.domain.model.building.MagicCastleBuilding;
import ru.lr.fantasy.domain.model.building.WallBuilding;
import ru.lr.fantasy.domain.model.building.WallLevel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class EconomyRulesTest {

    @Test
    public void buildingCostsMatchFeTable() {
        assertEquals(7_500L, EconomyRules.goldCostForBuilding(new CastleBuilding()));
        assertEquals(15_000L, EconomyRules.goldCostForBuilding(new BarrackBuilding()));
        assertEquals(10_000L, EconomyRules.goldCostForBuilding(new MagicCastleBuilding()));
        assertEquals(12_000L, EconomyRules.goldCostForBuilding(new ClericCastleBuilding()));
        assertEquals(5_000L, EconomyRules.goldCostForWall(WallLevel.FORTRESS_LEVEL_1));
        assertEquals(20_000L, EconomyRules.goldCostForBuilding(new WallBuilding(WallLevel.FORTRESS_LEVEL_4)));
    }

    @Test
    public void ordinaryPackCostScalesByForties() {
        assertEquals(500L, EconomyRules.goldCostForRecruit(WarriorType.FIGHTER, 40));
        assertEquals(1_000L, EconomyRules.goldCostForRecruit(WarriorType.FIGHTER, 80));
        assertEquals(400L, EconomyRules.goldCostForRecruit(WarriorType.HOBBIT, 40));
        assertEquals(2_000L, EconomyRules.goldCostForRecruit(WarriorType.ELF, 40));
        assertEquals(1_500L, EconomyRules.goldCostForRecruit(WarriorType.SHADOW_ELF, 40));
    }

    @Test
    public void siegeAndHeroPerUnit() {
        assertEquals(1_500L, EconomyRules.goldCostForRecruit(WarriorType.TARAN, 1));
        assertEquals(3_000L, EconomyRules.goldCostForRecruit(WarriorType.BALLISTA, 2));
        assertEquals(2_000L, EconomyRules.goldCostForRecruit(WarriorType.CATAPULT, 1));
        assertEquals(2_000L, EconomyRules.goldCostForRecruit(WarriorType.HERO_FIGHTER, 1));
        assertEquals(4_000L, EconomyRules.goldCostForRecruit(WarriorType.CLERIC, 1));
        assertEquals(4_000L, EconomyRules.goldCostForRecruit(WarriorType.MAGIC, 1));
    }

    @Test
    public void spendGoldRejectsWhenBroke() {
        Player dal = new Player(1, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(3, 3);
        long start = world.getPlayerWorldResources().get(1L).getGold();
        assertEquals(EconomyRules.STARTING_GOLD, start);
        try {
            EconomyRules.spendGold(world, 1L, start + 1);
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("Недостаточно золота"));
        }
        assertEquals(start, world.getPlayerWorldResources().get(1L).getGold());
        EconomyRules.spendGold(world, 1L, 500);
        assertEquals(start - 500, world.getPlayerWorldResources().get(1L).getGold());
    }

    @Test
    public void buildSpendsGold() {
        Player dal = new Player(1, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(3, 3);
        Land land = world.getPlayerLands(dal).get(0);
        long before = world.getPlayerWorldResources().get(1L).getGold();
        world.buildBuilding(land, new MagicCastleBuilding());
        assertEquals(before - EconomyRules.COST_MAGIC_CASTLE, world.getPlayerWorldResources().get(1L).getGold());
    }
}
