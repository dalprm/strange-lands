package ru.lr.fantasy.domain.model;

import org.junit.Test;

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
        assertEquals(0, world.findPlayerWorldResources(1L).orElseThrow().getGold());
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
