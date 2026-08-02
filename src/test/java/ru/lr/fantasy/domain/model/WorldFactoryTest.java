package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.building.Buildings;
import ru.lr.fantasy.domain.model.building.WallLevel;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class WorldFactoryTest {

    @Test
    public void testCreate() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        Player dragon = new Player(3, "Dragon");
        dragon.setId(2L);

        World world = new WorldFactory(dal, dragon).create(4, 4);

        assertEquals(16, world.getLands().size());
        assertEquals(1, world.getPlayerLands(dal).size());
        assertEquals(1, world.getPlayerLands(dragon).size());
        assertTrue(world.findPlayerWorldResources(1L).isPresent());
        assertTrue(world.findPlayerWorldResources(2L).isPresent());
        assertEquals(EconomyRules.STARTING_GOLD, world.findPlayerWorldResources(1L).orElseThrow().getGold());
        assertEquals(EconomyRules.STARTING_GOLD, world.findPlayerWorldResources(2L).orElseThrow().getGold());
        assertStartingCapital(world.getPlayerLands(dal).get(0).getBuildings());
        assertStartingCapital(world.getPlayerLands(dragon).get(0).getBuildings());
        for (Land land : world.getLands()) {
            assertTrue(land.getAccessBuildWarriorTypes().contains(WarriorType.FIGHTER));
            assertTrue(land.getAccessBuildWarriorTypes().contains(WarriorType.CATAPULT));
            assertTrue(land.getAccessBuildWarriorTypes().contains(WarriorType.BALLISTA));
            assertTrue(land.getAccessBuildWarriorTypes().contains(WarriorType.TARAN));
        }
    }

    @Test
    public void testInitStartingBuildingsForPlayerLand() {
        Land land = new Land(1, 1000, "1");
        WorldFactory.initStartingBuildingsForPlayerLand(land);
        assertStartingCapital(land.getBuildings());
    }

    private static void assertStartingCapital(Buildings buildings) {
        assertTrue(buildings.hasCastle());
        assertTrue(buildings.hasWall());
        assertEquals(WallLevel.FORTRESS_LEVEL_3, buildings.getWallLevel());
        assertEquals(2, buildings.getBarrackCount());
    }

    @Test
    public void testCreateException() {
        try {
            Player dal = new Player(3, "Dal");
            Player dragon = new Player(3, "Dragon");

            new WorldFactory(dal, dragon).create(1, 4);
            fail("Ожидается исключение IllegalArgumentException");
        } catch (IllegalArgumentException e) {
            assertEquals("Минимальные размеры поля 2x2", e.getMessage());
        }
    }
}
