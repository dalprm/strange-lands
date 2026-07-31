package ru.lr.fantasy.domain.model.building;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class BuildingsLimitsTest {

    @Test
    public void rejectsSecondCastle() {
        Buildings buildings = new Buildings();
        buildings.buildCastle();
        try {
            buildings.buildCastle();
            fail("expected IllegalStateException");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("замок"));
        }
        assertTrue(buildings.hasCastle());
    }

    @Test
    public void capsCountableBuildingsAtSix() {
        Buildings buildings = new Buildings();
        for (int i = 0; i < Buildings.maxCountableBuildings(); i++) {
            buildings.buildBarrack();
        }
        assertFalse(buildings.canBuildMore());
        assertEquals(6, buildings.getBarrackCount());
        try {
            buildings.buildMagicCastle();
            fail("expected IllegalStateException");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("лимит"));
        }
        assertEquals(0, buildings.getMagicCastleCount());
    }

    @Test
    public void wallAllowsOnlyUpgrade() {
        Buildings buildings = new Buildings();
        buildings.buildWall(WallLevel.FORTRESS_LEVEL_1);
        buildings.buildWall(WallLevel.FORTRESS_LEVEL_3);
        assertEquals(WallLevel.FORTRESS_LEVEL_3, buildings.getWallLevel());
        try {
            buildings.buildWall(WallLevel.FORTRESS_LEVEL_2);
            fail("expected IllegalStateException");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("улучшить"));
        }
        try {
            buildings.buildWall(WallLevel.FORTRESS_LEVEL_3);
            fail("expected IllegalStateException");
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("улучшить"));
        }
        assertEquals(WallLevel.FORTRESS_LEVEL_3, buildings.getWallLevel());
    }

    @Test
    public void castleAndWallDoNotConsumeCountableSlots() {
        Buildings buildings = new Buildings();
        buildings.buildCastle();
        buildings.buildWall(WallLevel.FORTRESS_LEVEL_1);
        for (int i = 0; i < Buildings.maxCountableBuildings(); i++) {
            buildings.buildBarrack();
        }
        assertTrue(buildings.hasCastle());
        assertTrue(buildings.hasWall());
        assertFalse(buildings.canBuildMore());
    }
}
