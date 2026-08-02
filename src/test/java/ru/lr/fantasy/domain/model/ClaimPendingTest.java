package ru.lr.fantasy.domain.model;

import org.junit.Test;
import ru.lr.fantasy.domain.model.action.WarriorsMoveInAction;
import ru.lr.fantasy.domain.model.action.WarriorsMoveOutAction;
import ru.lr.fantasy.domain.model.building.BarrackBuilding;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class ClaimPendingTest {

    @Test
    public void claimNeutralOnOrderSetsOwnerAndFlagWithoutTroops() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(4, 4);
        Land from = world.getPlayerLands(dal).get(0);
        from.addWarriors(new Warrior(WarriorType.FIGHTER, 40));
        Land to = from.getNeighboring().get(0);
        assertFalse(to.hasPlayer());

        world.claimNeutralOnMarchOrder(to, dal);

        assertEquals(dal, to.getPlayer());
        assertTrue(to.isClaimPending());
        assertTrue(to.getWarriors().isEmpty());
    }

    @Test
    public void secondPlayerSeesOccupiedNotNeutral() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        Player dragon = new Player(3, "Dragon");
        dragon.setId(2L);
        World world = new WorldFactory(dal, dragon).create(5, 5);
        Land dalLand = world.getPlayerLands(dal).get(0);
        Land target = null;
        for (Land n : dalLand.getNeighboring()) {
            if (!n.hasPlayer()) {
                target = n;
                break;
            }
        }
        assertTrue(target != null);

        world.claimNeutralOnMarchOrder(target, dal);
        assertTrue(target.hasPlayer());
        assertEquals(dal, target.getPlayer());

        // второй приказ не может claim'ить как нейтраль
        world.claimNeutralOnMarchOrder(target, dragon);
        assertEquals(dal, target.getPlayer());
        assertTrue(target.isClaimPending());
    }

    @Test
    public void firstArrivalClearsFlagAndAddsTroops() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(4, 4);
        Land from = world.getPlayerLands(dal).get(0);
        from.addWarriors(new Warrior(WarriorType.FIGHTER, 50));
        Land to = from.getNeighboring().get(0);

        world.claimNeutralOnMarchOrder(to, dal);
        new WarriorsMoveOutAction(world, from, new Warrior(WarriorType.FIGHTER, 40)).action();
        new WarriorsMoveInAction(world, to, dal, 1, new Warrior(WarriorType.FIGHTER, 40)).action();

        assertFalse(to.isClaimPending());
        assertEquals(1, to.getWarriors().size());
        assertEquals(40, to.getWarriors().get(0).getCount());
    }

    @Test
    public void buildBlockedWhileClaimPending() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        World world = new WorldFactory(dal).create(4, 4);
        world.ensurePlayerWorldResources(1L);
        Land from = world.getPlayerLands(dal).get(0);
        Land to = from.getNeighboring().get(0);
        world.claimNeutralOnMarchOrder(to, dal);

        try {
            world.buildBuilding(to, new BarrackBuilding());
            fail();
        } catch (IllegalStateException e) {
            assertTrue(e.getMessage().contains("пути"));
        }
    }

    @Test
    public void enemyTakesEmptyClaimPendingWithoutFight() {
        Player dal = new Player(3, "Dal");
        dal.setId(1L);
        Player dragon = new Player(3, "Dragon");
        dragon.setId(2L);
        World world = new WorldFactory().create(4, 4);
        Land land = world.getLands().get(0);
        world.claimNeutralOnMarchOrder(land, dal);
        assertTrue(land.isClaimPending());
        assertTrue(land.getWarriors().isEmpty());

        world.warriorsMoveIn(land, dragon, new Warrior(WarriorType.FIGHTER, 20));

        assertEquals(dragon, land.getPlayer());
        assertFalse(land.isClaimPending());
        assertEquals(20, land.getWarriors().get(0).getCount());
    }
}
